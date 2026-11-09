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

        final String finalNombreSala = nombreSala.trim();
        SalaColaborativa sala = salas.computeIfAbsent(pin, p -> {
            SalaColaborativa s = new SalaColaborativa();
            s.setPin(p);
            s.setNombreSala(finalNombreSala);
            s.setAnfitrion(anfitrion);
            s.setCreadaEn(LocalDateTime.now());
            return s;
        });

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
        return new ArrayList<>(salas.keySet());
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
        return InfoSesionDto.builder()
                .roomId(sala.getPin())
                .roomName(sala.getNombreSala())
                .hostName(sala.getAnfitrion().getName())
                .createdAt(sala.getCreadaEn().format(DateTimeFormatter.ofPattern("HH:mm")))
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
        private PerfilUsuarioDto anfitrion;
        private LocalDateTime creadaEn;
        private final List<PerfilUsuarioDto> participantes = new ArrayList<>();
        private Object diagramaActivo;

        public String getPin() { return pin; }
        public void setPin(String pin) { this.pin = pin; }
        public String getNombreSala() { return nombreSala; }
        public void setNombreSala(String nombreSala) { this.nombreSala = nombreSala; }
        public PerfilUsuarioDto getAnfitrion() { return anfitrion; }
        public void setAnfitrion(PerfilUsuarioDto anfitrion) { this.anfitrion = anfitrion; }
        public LocalDateTime getCreadaEn() { return creadaEn; }
        public void setCreadaEn(LocalDateTime creadaEn) { this.creadaEn = creadaEn; }
        public List<PerfilUsuarioDto> getParticipantes() { return participantes; }
        public Object getDiagramaActivo() { return diagramaActivo; }
        public void setDiagramaActivo(Object diagramaActivo) { this.diagramaActivo = diagramaActivo; }
    }
}
