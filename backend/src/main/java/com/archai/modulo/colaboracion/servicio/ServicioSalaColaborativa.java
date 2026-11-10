package com.archai.modulo.colaboracion.servicio;

import com.archai.comun.excepcion.ExcepcionNegocio;
import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.archai.modulo.colaboracion.dto.InfoSesionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * CU-03 — Crear y Unirse a Sala Colaborativa (STOMP).
 * Registro en memoria de salas con PIN de acceso de 6 dígitos con prefijo "ARC-".
 * Cada sala expone un canal WebSocket /topic/collab/{salaId} para sincronización STOMP.
 */
@Service
@RequiredArgsConstructor
public class ServicioSalaColaborativa {

    public boolean esAnfitrion(String pin, String usuarioId) {
        SalaColaborativa sala = salas.get(normalizarPin(pin));
        return sala != null && sala.getAnfitrion() != null
                && usuarioId.equals(sala.getAnfitrion().getId());
    }

    private static final String PREFIJO_PIN = "ARC-";

    private final Map<String, SalaColaborativa> salas = new ConcurrentHashMap<>();

    /** CU-03 · Flujo principal: el anfitrión crea la sala y obtiene su PIN para compartir. */
    public InfoSesionDto crearSala(String nombreSala, PerfilUsuarioDto anfitrion) {
        return crearSala(nombreSala, anfitrion, null);
    }

    public InfoSesionDto crearSala(String nombreSala, PerfilUsuarioDto anfitrion, String pinDeseado) {
        if (anfitrion == null) {
            throw new ExcepcionNegocio("Debe indicar el perfil del anfitrión para crear la sala.");
        }
        if (nombreSala == null || nombreSala.trim().isEmpty()) {
            nombreSala = "Sesión de Ingeniería";
        }

        String pin = (pinDeseado != null && !pinDeseado.trim().isEmpty())
                ? normalizarPin(pinDeseado)
                : generarPinUnico();

        // CU-03 · El PIN identifica una sala única: no se puede reutilizar el de otro anfitrión.
        SalaColaborativa salaExistente = salas.get(pin);
        if (salaExistente != null
                && salaExistente.getPropietarioId() != null
                && anfitrion.getId() != null
                && !salaExistente.getPropietarioId().equalsIgnoreCase(anfitrion.getId())) {
            throw new ExcepcionNegocio("El PIN " + pin + " ya está en uso por otra sala activa.");
        }

        final String finalNombreSala = nombreSala.trim();
        SalaColaborativa sala = salas.computeIfAbsent(pin, p -> {
            SalaColaborativa s = new SalaColaborativa();
            s.setPin(p);
            s.setNombreSala(finalNombreSala);
            s.setAnfitrion(anfitrion);
            s.setPropietarioId(anfitrion.getId());
            s.setCreadaEn(LocalDateTime.now());
            return s;
        });

        // Salas heredadas sin propietario registrado: se adoptan por quien las crea/retoma.
        if (sala.getPropietarioId() == null) {
            sala.setPropietarioId(anfitrion.getId());
        }

        if (sala.getParticipantes().stream().noneMatch(u -> u.getId() != null && u.getId().equals(anfitrion.getId()))) {
            sala.getParticipantes().add(anfitrion);
        }

        return construirSesion(sala, anfitrion, false);
    }

    @jakarta.annotation.PostConstruct
    public void inicializarSalaPorDefecto() {
        PerfilUsuarioDto anfitrion = PerfilUsuarioDto.builder()
                .id("usr-admin-01")
                .name("Ing. Carlos Criado")
                .email("carlos.criado@archai.io")
                .role("Arquitecto de Software")
                .avatarColor("#2563EB")
                .isHost(true)
                .build();
        SalaColaborativa sala = new SalaColaborativa();
        sala.setPin("ARC-GRUPO04");
        sala.setNombreSala("Sesión Examen CASE - Grupo 04");
        sala.setAnfitrion(anfitrion);
        sala.setPropietarioId(anfitrion.getId());
        sala.setCreadaEn(LocalDateTime.now());
        sala.getParticipantes().add(anfitrion);
        salas.put("ARC-GRUPO04", sala);
    }

    /** CU-03 · Flujo alterno: un colaborador se une mediante el PIN compartido. */
    public InfoSesionDto unirseSala(String pin, PerfilUsuarioDto usuario) {
        if (pin == null || pin.trim().isEmpty()) {
            throw new ExcepcionNegocio("Debe ingresar el código PIN de la sala.");
        }
        if (usuario == null) {
            throw new ExcepcionNegocio("Debe indicar el perfil del colaborador.");
        }

        String pinNormalizado = pin.trim().toUpperCase().startsWith(PREFIJO_PIN)
                ? pin.trim().toUpperCase()
                : PREFIJO_PIN + pin.trim().toUpperCase();

        SalaColaborativa sala = salas.get(pinNormalizado);
        if (sala == null) {
            throw new ExcepcionNegocio("No existe una sala activa con el código " + pinNormalizado + ".");
        }

        // Evitar duplicados del mismo usuario
        boolean yaExiste = sala.getParticipantes().stream()
                .anyMatch(p -> p.getId() != null && p.getId().equals(usuario.getId()));
        if (!yaExiste) {
            sala.getParticipantes().add(usuario);
        }

        return construirSesion(sala, usuario, false);
    }

    /** CU-03 · Flujo de salida: un colaborador abandona la sala y se actualiza la presencia. */
    public InfoSesionDto salirDeSala(String pin, String usuarioId) {
        if (pin == null || pin.trim().isEmpty()) {
            throw new ExcepcionNegocio("Debe ingresar el código PIN de la sala.");
        }
        String pinNormalizado = normalizarPin(pin);
        SalaColaborativa sala = salas.get(pinNormalizado);
        if (sala == null) {
            throw new ExcepcionNegocio("No existe una sala activa con el código " + pinNormalizado + ".");
        }

        if (usuarioId != null && !usuarioId.trim().isEmpty()) {
            String uid = usuarioId.trim();
            sala.getParticipantes().removeIf(p -> p.getId() != null && p.getId().equalsIgnoreCase(uid));
        }

        return construirSesion(sala, sala.getAnfitrion(), false);
    }

    /** CU-03 · Obtiene los colaboradores conectados en vivo a la sala. */
    public List<PerfilUsuarioDto> listarParticipantes(String pin) {
        String pinNormalizado = normalizarPin(pin);
        SalaColaborativa sala = salas.get(pinNormalizado);
        if (sala == null) {
            return new ArrayList<>();
        }
        return new ArrayList<>(sala.getParticipantes());
    }

    /** CU-03 · Consulta la información de una sala existente (útil para reanudar sesión). */
    public InfoSesionDto consultarSala(String pin) {
        String pinNormalizado = normalizarPin(pin);
        SalaColaborativa sala = salas.get(pinNormalizado);
        if (sala == null) {
            throw new ExcepcionNegocio("No existe una sala activa con el código " + pinNormalizado + ".");
        }
        return construirSesion(sala, sala.getAnfitrion(), false);
    }

    public List<String> listarPinesActivos() {
        return listarPinesActivos(null);
    }

    /**
     * CU-03 · Salas visibles para una cuenta: las que creó y aquellas a las que se unió con el PIN.
     * Sin `usuarioId` mantiene el comportamiento global (compatibilidad con clientes antiguos).
     */
    public List<String> listarPinesActivos(String usuarioId) {
        if (usuarioId == null || usuarioId.trim().isEmpty()) {
            return new ArrayList<>(salas.keySet());
        }
        String uid = usuarioId.trim();
        return salas.values().stream()
                .filter(sala -> esVisiblePara(sala, uid))
                .map(SalaColaborativa::getPin)
                .collect(Collectors.toList());
    }

    private boolean esVisiblePara(SalaColaborativa sala, String usuarioId) {
        if (sala.getPropietarioId() != null && sala.getPropietarioId().equalsIgnoreCase(usuarioId)) {
            return true;
        }
        return sala.getParticipantes().stream()
                .anyMatch(p -> p.getId() != null && p.getId().equalsIgnoreCase(usuarioId));
    }

    public int totalSalasActivas() {
        return salas.size();
    }

    /** CU-03 · Obtiene el diagrama actualmente activo de la sala. */
    public Object obtenerDiagramaDeSala(String pin) {
        String pinNormalizado = normalizarPin(pin);
        SalaColaborativa sala = salas.get(pinNormalizado);
        if (sala == null) {
            return null;
        }
        return sala.getDiagramaActivo();
    }

    /** CU-03 · Actualiza el diagrama activo en memoria para que nuevos colaboradores lo reciban. */
    public void actualizarDiagramaDeSala(String pin, Object diagrama) {
        if (pin == null || diagrama == null) return;
        try {
            String pinNormalizado = normalizarPin(pin);
            SalaColaborativa sala = salas.computeIfAbsent(pinNormalizado, k -> {
                SalaColaborativa s = new SalaColaborativa();
                s.setPin(k);
                s.setNombreSala("Sala " + k);
                s.setCreadaEn(LocalDateTime.now());
                return s;
            });
            sala.setDiagramaActivo(diagrama);
        } catch (Exception ignored) {
        }
    }

    private InfoSesionDto construirSesion(SalaColaborativa sala, PerfilUsuarioDto usuario, boolean modoLocal) {
        String nombreAnfitrion = (sala.getAnfitrion() != null && sala.getAnfitrion().getName() != null)
                ? sala.getAnfitrion().getName()
                : "Sala abierta";
        String creadaEn = sala.getCreadaEn() != null
                ? sala.getCreadaEn().format(DateTimeFormatter.ofPattern("HH:mm"))
                : "";

        return InfoSesionDto.builder()
                .roomId(sala.getPin())
                .roomName(sala.getNombreSala())
                .hostName(nombreAnfitrion)
                .createdAt(creadaEn)
                .currentUser(usuario)
                .participants(new ArrayList<>(sala.getParticipantes()))
                .isLocalMode(modoLocal)
                .build();
    }

    private String normalizarPin(String pin) {
        if (pin == null || pin.trim().isEmpty()) {
            throw new ExcepcionNegocio("Debe ingresar el código PIN de la sala.");
        }
        String limpio = pin.trim().toUpperCase();
        return limpio.startsWith(PREFIJO_PIN) ? limpio : PREFIJO_PIN + limpio;
    }

    private String generarPinUnico() {
        String pin;
        do {
            pin = PREFIJO_PIN + (100000 + (int) (Math.random() * 900000));
        } while (salas.containsKey(pin));
        return pin;
    }

    /** Entidad ligera en memoria de una sala colaborativa. */
    private static class SalaColaborativa {
        private String pin;
        private String nombreSala;
        private String propietarioId;
        private PerfilUsuarioDto anfitrion;
        private LocalDateTime creadaEn;
        private final List<PerfilUsuarioDto> participantes = new ArrayList<>();
        private Object diagramaActivo;

        public String getPin() { return pin; }
        public void setPin(String pin) { this.pin = pin; }
        public String getNombreSala() { return nombreSala; }
        public void setNombreSala(String nombreSala) { this.nombreSala = nombreSala; }
        public String getPropietarioId() { return propietarioId; }
        public void setPropietarioId(String propietarioId) { this.propietarioId = propietarioId; }
        public PerfilUsuarioDto getAnfitrion() { return anfitrion; }
        public void setAnfitrion(PerfilUsuarioDto anfitrion) { this.anfitrion = anfitrion; }
        public LocalDateTime getCreadaEn() { return creadaEn; }
        public void setCreadaEn(LocalDateTime creadaEn) { this.creadaEn = creadaEn; }
        public List<PerfilUsuarioDto> getParticipantes() { return participantes; }
        public Object getDiagramaActivo() { return diagramaActivo; }
        public void setDiagramaActivo(Object diagramaActivo) { this.diagramaActivo = diagramaActivo; }
    }
}
