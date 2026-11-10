package com.archai.modulo.proyecto.servicio;

import com.archai.comun.excepcion.ExcepcionNegocio;
import com.archai.comun.excepcion.ExcepcionRecursoNoEncontrado;
import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.proyecto.dto.*;
import com.archai.modulo.proyecto.entidad.MiembroProyectoEntity;
import com.archai.modulo.proyecto.entidad.ProyectoEntity;
import com.archai.modulo.proyecto.repositorio.MiembroProyectoRepository;
import com.archai.modulo.proyecto.repositorio.ProyectoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServicioProyecto {

    private final ProyectoRepository proyectoRepository;
    private final MiembroProyectoRepository miembroProyectoRepository;
    private final UsuarioRepository usuarioRepository;
    private final DiagramaRepository diagramaRepository;

    @Transactional(readOnly = true)
    public List<ProyectoDto> listarProyectos(String usuarioId) {
        List<ProyectoEntity> proyectos;
        if (usuarioId != null && !usuarioId.trim().isEmpty()) {
            proyectos = proyectoRepository.findProyectosByUsuario(usuarioId);
        } else {
            proyectos = proyectoRepository.findAll();
        }
        return proyectos.stream().map(this::mapearProyectoADto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProyectoDto obtenerProyectoPorId(String id) {
        ProyectoEntity proyecto = proyectoRepository.findById(id)
                .orElseThrow(() -> new ExcepcionRecursoNoEncontrado("No se encontró el proyecto con ID: " + id));
        return mapearProyectoADto(proyecto);
    }

    @Transactional
    public ProyectoDto crearProyecto(CrearProyectoSolicitudDto solicitud) {
        if (solicitud.getNombre() == null || solicitud.getNombre().trim().isEmpty()) {
            throw new ExcepcionNegocio("El nombre del proyecto es obligatorio.");
        }

        UsuarioEntity propietario = null;
        if (solicitud.getPropietarioId() != null) {
            propietario = usuarioRepository.findById(solicitud.getPropietarioId()).orElse(null);
        }
        if (propietario == null) {
            propietario = usuarioRepository.findAll().stream().findFirst().orElse(null);
        }

        String id = "proy-" + UUID.randomUUID().toString();
        String codigoAcceso = generarCodigoAcceso(solicitud.getNombre());

        ProyectoEntity proyecto = ProyectoEntity.builder()
                .id(id)
                .nombre(solicitud.getNombre().trim())
                .descripcion(solicitud.getDescripcion())
                .codigoAcceso(codigoAcceso)
                .iconoColor(solicitud.getIconoColor() != null ? solicitud.getIconoColor() : "#3B82F6")
                .estado("ACTIVO")
                .propietario(propietario)
                .fechaCreacion(LocalDateTime.now())
                .fechaActualizacion(LocalDateTime.now())
                .build();

        proyecto = proyectoRepository.save(proyecto);

        if (propietario != null) {
            MiembroProyectoEntity miembroPropietario = MiembroProyectoEntity.builder()
                    .id("miembro-" + UUID.randomUUID())
                    .proyecto(proyecto)
                    .usuario(propietario)
                    .rolProyecto("PROPIETARIO")
                    .fechaAgregado(LocalDateTime.now())
                    .build();
            miembroProyectoRepository.save(miembroPropietario);
        }

        return mapearProyectoADto(proyecto);
    }

    @Transactional
    public MiembroProyectoDto invitarMiembro(String proyectoId, InvitarMiembroDto solicitud) {
        ProyectoEntity proyecto = proyectoRepository.findById(proyectoId)
                .orElseThrow(() -> new ExcepcionRecursoNoEncontrado("Proyecto no encontrado: " + proyectoId));

        String query = solicitud.getCorreoOUsuario() != null ? solicitud.getCorreoOUsuario().trim() : "";
        if (query.isEmpty()) {
            throw new ExcepcionNegocio("Debe indicar el correo, usuario o ID del miembro a invitar.");
        }

        Optional<UsuarioEntity> usuarioOpt = usuarioRepository.findById(query);
        if (usuarioOpt.isEmpty()) usuarioOpt = usuarioRepository.findByCorreoIgnoreCase(query);
        if (usuarioOpt.isEmpty()) usuarioOpt = usuarioRepository.findByNombreUsuarioIgnoreCase(query);

        UsuarioEntity usuario = usuarioOpt.orElseThrow(() -> 
                new ExcepcionRecursoNoEncontrado("No se encontró ningún usuario con: " + query));

        if (miembroProyectoRepository.existsByProyectoIdAndUsuarioId(proyectoId, usuario.getId())) {
            throw new ExcepcionNegocio("El usuario " + usuario.getNombre() + " ya es miembro de este proyecto.");
        }

        String rol = solicitud.getRolProyecto() != null ? solicitud.getRolProyecto().toUpperCase() : "EDITOR";

        MiembroProyectoEntity miembro = MiembroProyectoEntity.builder()
                .id("miembro-" + UUID.randomUUID())
                .proyecto(proyecto)
                .usuario(usuario)
                .rolProyecto(rol)
                .fechaAgregado(LocalDateTime.now())
                .build();

        miembro = miembroProyectoRepository.save(miembro);
        return mapearMiembroADto(miembro);
    }

    /**
     * CU-02 · Un colaborador se une a un proyecto compartido usando su código de acceso.
     * Idempotente: si ya es miembro, devuelve el proyecto sin duplicar la membresía.
     */
    @Transactional
    public ProyectoDto unirseProyectoPorCodigo(UnirseProyectoSolicitudDto solicitud) {
        String codigo = solicitud != null && solicitud.getCodigoAcceso() != null
                ? solicitud.getCodigoAcceso().trim().toUpperCase()
                : "";
        if (codigo.isEmpty()) {
            throw new ExcepcionNegocio("Debe indicar el código de acceso del proyecto.");
        }

        ProyectoEntity proyecto = proyectoRepository.findByCodigoAccesoIgnoreCase(codigo)
                .orElseThrow(() -> new ExcepcionRecursoNoEncontrado(
                        "No existe un proyecto con el código " + codigo + "."));

        String identificador = solicitud.getUsuarioId() != null && !solicitud.getUsuarioId().trim().isEmpty()
                ? solicitud.getUsuarioId().trim()
                : (solicitud.getCorreoOUsuario() != null ? solicitud.getCorreoOUsuario().trim() : "");

        if (identificador.isEmpty()) {
            throw new ExcepcionNegocio("Debe indicar el usuario que se une al proyecto.");
        }

        Optional<UsuarioEntity> usuarioOpt = usuarioRepository.findById(identificador);
        if (usuarioOpt.isEmpty()) usuarioOpt = usuarioRepository.findByCorreoIgnoreCase(identificador);
        if (usuarioOpt.isEmpty()) usuarioOpt = usuarioRepository.findByNombreUsuarioIgnoreCase(identificador);
        UsuarioEntity usuario = usuarioOpt.orElseThrow(() -> new ExcepcionRecursoNoEncontrado(
                "No se encontró ningún usuario con: " + identificador));

        if (!miembroProyectoRepository.existsByProyectoIdAndUsuarioId(proyecto.getId(), usuario.getId())) {
            MiembroProyectoEntity miembro = MiembroProyectoEntity.builder()
                    .id("miembro-" + UUID.randomUUID())
                    .proyecto(proyecto)
                    .usuario(usuario)
                    .rolProyecto("EDITOR")
                    .fechaAgregado(LocalDateTime.now())
                    .build();
            miembroProyectoRepository.save(miembro);
        }

        return mapearProyectoADto(proyecto);
    }

    @Transactional
    public void removerMiembro(String proyectoId, String usuarioId) {
        miembroProyectoRepository.deleteByProyectoIdAndUsuarioId(proyectoId, usuarioId);
    }

    @Transactional
    public void eliminarProyecto(String id) {
        if (!proyectoRepository.existsById(id)) {
            throw new ExcepcionRecursoNoEncontrado("Proyecto no encontrado: " + id);
        }
        proyectoRepository.deleteById(id);
    }

    public ProyectoDto mapearProyectoADto(ProyectoEntity p) {
        List<MiembroProyectoDto> miembros = miembroProyectoRepository.findByProyectoId(p.getId()).stream()
                .map(this::mapearMiembroADto)
                .collect(Collectors.toList());

        int totalDiags = diagramaRepository.countByProyectoId(p.getId());

        return ProyectoDto.builder()
                .id(p.getId())
                .nombre(p.getNombre())
                .descripcion(p.getDescripcion())
                .codigoAcceso(p.getCodigoAcceso())
                .iconoColor(p.getIconoColor())
                .estado(p.getEstado())
                .propietarioId(p.getPropietario() != null ? p.getPropietario().getId() : null)
                .propietarioNombre(p.getPropietario() != null ? p.getPropietario().getNombre() : null)
                .fechaCreacion(p.getFechaCreacion())
                .fechaActualizacion(p.getFechaActualizacion())
                .totalDiagramas(totalDiags)
                .miembros(miembros)
                .build();
    }

    public MiembroProyectoDto mapearMiembroADto(MiembroProyectoEntity m) {
        return MiembroProyectoDto.builder()
                .id(m.getId())
                .usuarioId(m.getUsuario().getId())
                .nombre(m.getUsuario().getNombre())
                .correo(m.getUsuario().getCorreo())
                .avatarColor(m.getUsuario().getColorAvatar())
                .rolProyecto(m.getRolProyecto())
                .fechaAgregado(m.getFechaAgregado())
                .build();
    }

    private String generarCodigoAcceso(String nombre) {
        String base = nombre.replaceAll("[^a-zA-Z0-9]", "").toUpperCase();
        if (base.length() > 6) base = base.substring(0, 6);
        return base + "-" + (int)(1000 + Math.random() * 9000);
    }
}
