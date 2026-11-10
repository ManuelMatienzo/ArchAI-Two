package com.archai.modulo.diagrama.servicio;

import com.archai.comun.excepcion.ExcepcionRecursoNoEncontrado;
import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.diagrama.dto.*;
import com.archai.modulo.diagrama.entidad.ComentarioDiagramaEntity;
import com.archai.modulo.diagrama.entidad.DiagramaEntity;
import com.archai.modulo.diagrama.entidad.VersionDiagramaEntity;
import com.archai.modulo.diagrama.repositorio.ComentarioDiagramaRepository;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.diagrama.repositorio.VersionDiagramaRepository;
import com.archai.modulo.proyecto.entidad.ProyectoEntity;
import com.archai.modulo.proyecto.repositorio.ProyectoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ServicioDiagrama {

    private final DiagramaRepository diagramaRepository;
    private final VersionDiagramaRepository versionDiagramaRepository;
    private final ComentarioDiagramaRepository comentarioDiagramaRepository;
    private final ProyectoRepository proyectoRepository;
    private final UsuarioRepository usuarioRepository;
    private final ObjectMapper objectMapper;
    private final org.springframework.context.ApplicationEventPublisher eventos;

    @Transactional
    public DiagramDto guardarDiagrama(DiagramDto dto) {
        String id =
            dto.getId() != null && !dto.getId().trim().isEmpty() ? dto.getId() : "diag-" + UUID.randomUUID().toString();

        ProyectoEntity proyecto = null;
        if (dto.getProyectoId() != null) {
            proyecto = proyectoRepository.findById(dto.getProyectoId()).orElse(null);
        }

        UsuarioEntity creador = null;
        if (dto.getCreadorId() != null) {
            creador = usuarioRepository.findById(dto.getCreadorId()).orElse(null);
        }

        String jsonPayload;
        try {
            jsonPayload = objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "No se pudo convertir el diagrama para guardarlo. Tu diseño se conserva."
            );
        }

        Optional<DiagramaEntity> existente = diagramaRepository.findForUpdate(id);
        if (existente.isPresent()) {
            try {
                long revision = objectMapper
                    .readTree(existente.get().getJsonDiagrama())
                    .path("_reviewRevision")
                    .asLong(0);
                long recibida = objectMapper.valueToTree(dto).path("_reviewRevision").asLong(0);
                if (revision > recibida) throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "El diagrama cambió. Recupera la versión actual antes de guardar."
                );
            } catch (java.io.IOException ex) {
                throw new IllegalStateException("No se pudo recuperar la versión oficial.", ex);
            }
        }
        DiagramaEntity entidad;
        if (existente.isPresent()) {
            entidad = existente.get();
            entidad.setTitulo(dto.getTitle() != null ? dto.getTitle() : "Diagrama Sin Título");
            entidad.setDescripcion(dto.getDescription());
            entidad.setJsonDiagrama(jsonPayload);
            entidad.setFechaActualizacion(LocalDateTime.now());
            if (proyecto != null) entidad.setProyecto(proyecto);
        } else {
            entidad = DiagramaEntity.builder()
                .id(id)
                .proyecto(proyecto)
                .creador(creador)
                .titulo(dto.getTitle() != null ? dto.getTitle() : "Nuevo Diagrama UML")
                .descripcion(dto.getDescription())
                .jsonDiagrama(jsonPayload)
                .fechaCreacion(LocalDateTime.now())
                .fechaActualizacion(LocalDateTime.now())
                .build();
        }

        entidad = diagramaRepository.save(entidad);
        dto.setId(entidad.getId());
        dto.setCreatedAt(entidad.getFechaCreacion());
        dto.setUpdatedAt(entidad.getFechaActualizacion());
        eventos.publishEvent(new DiagramaPersistido(entidad.getId(), entidad.getJsonDiagrama()));
        return dto;
    }

    @Transactional(readOnly = true)
    public List<DiagramDto> listarDiagramas(String proyectoId) {
        List<DiagramaEntity> lista;
        if (proyectoId != null && !proyectoId.trim().isEmpty()) {
            lista = diagramaRepository.findByProyectoId(proyectoId);
        } else {
            lista = diagramaRepository.findAll();
        }

        List<DiagramDto> resultado = new ArrayList<>();
        for (DiagramaEntity ent : lista) {
            try {
                DiagramDto d = objectMapper.readValue(ent.getJsonDiagrama(), DiagramDto.class);
                d.setId(ent.getId());
                d.setTitle(ent.getTitulo());
                d.setDescription(ent.getDescripcion());
                d.setCreatedAt(ent.getFechaCreacion());
                d.setUpdatedAt(ent.getFechaActualizacion());
                if (ent.getProyecto() != null) d.setProyectoId(ent.getProyecto().getId());
                if (ent.getCreador() != null) d.setCreadorId(ent.getCreador().getId());
                resultado.add(d);
            } catch (Exception e) {
                resultado.add(
                    DiagramDto.builder()
                        .id(ent.getId())
                        .title(ent.getTitulo())
                        .description(ent.getDescripcion())
                        .proyectoId(ent.getProyecto() != null ? ent.getProyecto().getId() : null)
                        .createdAt(ent.getFechaCreacion())
                        .updatedAt(ent.getFechaActualizacion())
                        .classes(new ArrayList<>())
                        .relations(new ArrayList<>())
                        .build()
                );
            }
        }
        return resultado;
    }

    @Transactional(readOnly = true)
    public Optional<DiagramDto> obtenerPorId(String id) {
        return diagramaRepository.findById(id).map(ent -> {
            try {
                DiagramDto d = objectMapper.readValue(ent.getJsonDiagrama(), DiagramDto.class);
                d.setId(ent.getId());
                d.setTitle(ent.getTitulo());
                d.setDescription(ent.getDescripcion());
                d.setCreatedAt(ent.getFechaCreacion());
                d.setUpdatedAt(ent.getFechaActualizacion());
                if (ent.getProyecto() != null) d.setProyectoId(ent.getProyecto().getId());
                if (ent.getCreador() != null) d.setCreadorId(ent.getCreador().getId());
                return d;
            } catch (Exception e) {
                return DiagramDto.builder()
                    .id(ent.getId())
                    .title(ent.getTitulo())
                    .description(ent.getDescripcion())
                    .createdAt(ent.getFechaCreacion())
                    .updatedAt(ent.getFechaActualizacion())
                    .classes(new ArrayList<>())
                    .relations(new ArrayList<>())
                    .build();
            }
        });
    }

    @Transactional
    public VersionDiagramaDto crearVersion(
        String diagramaId,
        String etiqueta,
        String descripcionCambio,
        String autorId
    ) {
        DiagramaEntity diagrama = diagramaRepository
            .findById(diagramaId)
            .orElseThrow(() -> new ExcepcionRecursoNoEncontrado("Diagrama no encontrado: " + diagramaId));

        int siguienteNumero = versionDiagramaRepository
            .findTopByDiagramaIdOrderByNumeroVersionDesc(diagramaId)
            .map(v -> v.getNumeroVersion() + 1)
            .orElse(1);

        UsuarioEntity autor = autorId != null ? usuarioRepository.findById(autorId).orElse(null) : null;

        VersionDiagramaEntity version = VersionDiagramaEntity.builder()
            .id("ver-" + UUID.randomUUID())
            .diagrama(diagrama)
            .numeroVersion(siguienteNumero)
            .etiqueta(etiqueta != null ? etiqueta : "v" + siguienteNumero + ".0")
            .descripcionCambio(descripcionCambio)
            .jsonDiagrama(diagrama.getJsonDiagrama())
            .autor(autor)
            .fechaCreacion(LocalDateTime.now())
            .build();

        version = versionDiagramaRepository.save(version);

        return VersionDiagramaDto.builder()
            .id(version.getId())
            .diagramaId(diagramaId)
            .numeroVersion(version.getNumeroVersion())
            .etiqueta(version.getEtiqueta())
            .descripcionCambio(version.getDescripcionCambio())
            .autorId(autor != null ? autor.getId() : null)
            .autorNombre(autor != null ? autor.getNombre() : null)
            .fechaCreacion(version.getFechaCreacion())
            .build();
    }

    @Transactional(readOnly = true)
    public List<VersionDiagramaDto> listarVersiones(String diagramaId) {
        return versionDiagramaRepository
            .findByDiagramaIdOrderByNumeroVersionDesc(diagramaId)
            .stream()
            .map(v ->
                VersionDiagramaDto.builder()
                    .id(v.getId())
                    .diagramaId(diagramaId)
                    .numeroVersion(v.getNumeroVersion())
                    .etiqueta(v.getEtiqueta())
                    .descripcionCambio(v.getDescripcionCambio())
                    .autorId(v.getAutor() != null ? v.getAutor().getId() : null)
                    .autorNombre(v.getAutor() != null ? v.getAutor().getNombre() : null)
                    .fechaCreacion(v.getFechaCreacion())
                    .build()
            )
            .collect(Collectors.toList());
    }

    @Transactional
    public DiagramDto restaurarVersion(String diagramaId, String versionId) {
        VersionDiagramaEntity version = versionDiagramaRepository
            .findById(versionId)
            .orElseThrow(() -> new ExcepcionRecursoNoEncontrado("Versión no encontrada: " + versionId));

        if (!version.getDiagrama().getId().equals(diagramaId)) throw new ExcepcionRecursoNoEncontrado(
            "La versión no pertenece a este diagrama."
        );
        DiagramaEntity diagrama = diagramaRepository.findForUpdate(diagramaId).orElseThrow();
        try {
            var restored = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(
                version.getJsonDiagrama()
            );
            long revision = objectMapper.readTree(diagrama.getJsonDiagrama()).path("_reviewRevision").asLong();
            restored.put("_reviewRevision", revision + 1);
            diagrama.setJsonDiagrama(restored.toString());
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("No se pudo recuperar la versión.");
        }
        eventos.publishEvent(new DiagramaPersistido(diagramaId, diagrama.getJsonDiagrama()));
        diagrama.setFechaActualizacion(LocalDateTime.now());
        diagramaRepository.save(diagrama);

        return obtenerPorId(diagramaId).orElseThrow();
    }

    @Transactional
    public void eliminarDiagrama(String id) {
        diagramaRepository.deleteById(id);
    }
}
