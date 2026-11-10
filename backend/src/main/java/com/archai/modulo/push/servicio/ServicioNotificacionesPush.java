package com.archai.modulo.push.servicio;

import com.archai.comun.excepcion.ExcepcionNegocio;
import com.archai.modulo.push.dto.AlertaPushDto;
import com.archai.modulo.push.dto.RegistroPushDto;
import com.archai.modulo.push.dto.ResultadoPushDto;
import com.archai.modulo.push.entidad.SuscripcionPush;
import com.archai.modulo.push.repositorio.RepositorioSuscripcionPush;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * CU-23 — Registro de dispositivos y despacho de alertas críticas.
 *
 * <p>La alerta se dirige, en este orden de prioridad, a: usuarios explícitos → dispositivos
 * suscritos a la sala/proyecto → todas las suscripciones activas. Cada token se envía una
 * sola vez y por el canal que lo soporte (FCM o Expo Push).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServicioNotificacionesPush {

    private static final int MAX_DETALLES = 20;

    private final RepositorioSuscripcionPush repositorio;
    private final List<DespachadorPush> despachadores;
    private final DespachadorFcmHttpV1 despachadorFcm;
    private final DespachadorExpoPush despachadorExpo;

    // ------------------------------------------------------------------
    // Registro de dispositivos
    // ------------------------------------------------------------------

    @Transactional
    public SuscripcionPush registrar(RegistroPushDto dto) {
        if (dto == null || dto.getToken() == null || dto.getToken().isBlank()) {
            throw new ExcepcionNegocio("El token push es obligatorio para registrar el dispositivo.");
        }

        String token = dto.getToken().trim();
        if (token.length() > 512) {
            throw new ExcepcionNegocio("El token push supera la longitud permitida.");
        }

        SuscripcionPush suscripcion = repositorio.findByToken(token).orElseGet(() -> SuscripcionPush.builder()
                .token(token)
                .build());

        if (dto.getUsuarioId() != null) {
            suscripcion.setUsuarioId(limpiar(dto.getUsuarioId()));
        }
        if (dto.getSalaId() != null) {
            suscripcion.setSalaId(limpiar(dto.getSalaId()));
        }
        if (dto.getProyectoId() != null) {
            suscripcion.setProyectoId(limpiar(dto.getProyectoId()));
        }
        if (dto.getPlataforma() != null && !dto.getPlataforma().isBlank()) {
            suscripcion.setPlataforma(dto.getPlataforma().trim());
        } else if (suscripcion.getPlataforma() == null) {
            suscripcion.setPlataforma("mobile-react-native");
        }
        if (dto.getDispositivo() != null && !dto.getDispositivo().isBlank()) {
            suscripcion.setDispositivo(dto.getDispositivo().trim());
        }

        suscripcion.setActiva(Boolean.TRUE);
        return repositorio.save(suscripcion);
    }

    @Transactional
    public void desactivar(String token) {
        if (token == null || token.isBlank()) return;
        repositorio.findByToken(token.trim()).ifPresent(suscripcion -> {
            suscripcion.setActiva(Boolean.FALSE);
            repositorio.save(suscripcion);
        });
    }

    @Transactional
    public void desactivarUsuario(String usuarioId) {
        if (usuarioId == null || usuarioId.isBlank()) return;
        List<SuscripcionPush> activas = repositorio.findByUsuarioIdAndActivaTrue(usuarioId.trim());
        activas.forEach(suscripcion -> suscripcion.setActiva(Boolean.FALSE));
        repositorio.saveAll(activas);
    }

    @Transactional(readOnly = true)
    public long contarActivas() {
        return repositorio.countByActivaTrue();
    }

    @Transactional(readOnly = true)
    public long contarActivas(String usuarioId) {
        if (usuarioId == null || usuarioId.isBlank()) return contarActivas();
        return repositorio.countByUsuarioIdAndActivaTrue(usuarioId.trim());
    }

    // ------------------------------------------------------------------
    // Despacho de alertas
    // ------------------------------------------------------------------

    /**
     * Variante no bloqueante para eventos críticos detectados en el canal colaborativo:
     * nunca retrasa ni rompe la retransmisión STOMP.
     */
    @Async("pushTaskExecutor")
    public void enviarAlertaCriticaAsync(AlertaPushDto alerta) {
        try {
            enviarAlertaCritica(alerta);
        } catch (Exception e) {
            log.warn("[CU-23] No se pudo despachar la alerta crítica asíncrona: {}", e.getMessage());
        }
    }

    public ResultadoPushDto enviarAlertaCritica(AlertaPushDto alerta) {
        AlertaPushDto solicitud = alerta != null ? alerta : new AlertaPushDto();
        List<SuscripcionPush> destinatarios = resolverDestinatarios(solicitud);

        MensajePush mensaje = new MensajePush(
                textoOManual(solicitud.getTitulo(), "Cambio crítico en ArchAI"),
                textoOManual(solicitud.getCuerpo(), "Se detectó un cambio crítico que requiere tu revisión."),
                textoOManual(solicitud.getTipo(), "CAMBIO_CRITICO"),
                construirDatos(solicitud)
        );

        int enviados = 0;
        int fallidos = 0;
        int omitidos = 0;
        List<String> detalles = new ArrayList<>();

        for (SuscripcionPush suscripcion : destinatarios) {
            DespachadorPush canal = despachadores.stream()
                    .filter(despachador -> despachador.soporta(suscripcion.getToken()))
                    .findFirst()
                    .orElse(null);

            if (canal == null) {
                fallidos++;
                agregarDetalle(detalles, "SIN_CANAL");
                continue;
            }

            if (!canal.estaConfigurado()) {
                omitidos++;
                agregarDetalle(detalles, canal.canal() + ":no-configurado");
                continue;
            }

            if (canal.despachar(suscripcion.getToken(), mensaje)) {
                enviados++;
                agregarDetalle(detalles, canal.canal() + ":enviado");
            } else {
                fallidos++;
                agregarDetalle(detalles, canal.canal() + ":fallido");
            }
        }

        if (destinatarios.isEmpty()) {
            log.info("[CU-23] Alerta sin destinatarios (sala={}, proyecto={}, usuarios={}).",
                    solicitud.getSalaId(), solicitud.getProyectoId(),
                    solicitud.getUsuarioIds() != null ? solicitud.getUsuarioIds().size() : 0);
        }

        return ResultadoPushDto.builder()
                .total(destinatarios.size())
                .enviados(enviados)
                .fallidos(fallidos)
                .omitidos(omitidos)
                .fcmConfigurado(despachadorFcm.estaConfigurado())
                .expoDisponible(despachadorExpo.estaConfigurado())
                .detalles(detalles)
                .build();
    }

    private List<SuscripcionPush> resolverDestinatarios(AlertaPushDto alerta) {
        Map<String, SuscripcionPush> unicos = new LinkedHashMap<>();

        if (alerta.getUsuarioIds() != null && !alerta.getUsuarioIds().isEmpty()) {
            Set<String> usuarios = new LinkedHashSet<>(alerta.getUsuarioIds());
            for (String usuarioId : usuarios) {
                if (usuarioId == null || usuarioId.isBlank()) continue;
                repositorio.findByUsuarioIdAndActivaTrue(usuarioId.trim())
                        .forEach(suscripcion -> unicos.putIfAbsent(suscripcion.getToken(), suscripcion));
            }
            return new ArrayList<>(unicos.values());
        }

        boolean filtroSala = alerta.getSalaId() != null && !alerta.getSalaId().isBlank();
        boolean filtroProyecto = alerta.getProyectoId() != null && !alerta.getProyectoId().isBlank();

        if (filtroSala) {
            repositorio.findBySalaIdAndActivaTrue(alerta.getSalaId().trim())
                    .forEach(suscripcion -> unicos.putIfAbsent(suscripcion.getToken(), suscripcion));
        }
        if (filtroProyecto) {
            repositorio.findByProyectoIdAndActivaTrue(alerta.getProyectoId().trim())
                    .forEach(suscripcion -> unicos.putIfAbsent(suscripcion.getToken(), suscripcion));
        }

        if (!filtroSala && !filtroProyecto) {
            repositorio.findByActivaTrue()
                    .forEach(suscripcion -> unicos.putIfAbsent(suscripcion.getToken(), suscripcion));
        }

        return new ArrayList<>(unicos.values());
    }

    private Map<String, String> construirDatos(AlertaPushDto alerta) {
        Map<String, String> datos = new LinkedHashMap<>();
        if (alerta.getDatos() != null) {
            alerta.getDatos().forEach((clave, valor) -> {
                if (clave != null && valor != null) datos.put(clave, valor);
            });
        }
        if (alerta.getSalaId() != null && !alerta.getSalaId().isBlank()) {
            datos.putIfAbsent("roomId", alerta.getSalaId().trim());
        }
        if (alerta.getProyectoId() != null && !alerta.getProyectoId().isBlank()) {
            datos.putIfAbsent("projectId", alerta.getProyectoId().trim());
        }
        datos.putIfAbsent("tipo", textoOManual(alerta.getTipo(), "CAMBIO_CRITICO"));
        return datos;
    }

    private void agregarDetalle(List<String> detalles, String detalle) {
        if (detalles.size() < MAX_DETALLES) {
            detalles.add(detalle);
        }
    }

    private String textoOManual(String valor, String porDefecto) {
        return (valor == null || valor.isBlank()) ? porDefecto : valor.trim();
    }

    private String limpiar(String valor) {
        return valor == null ? null : valor.trim();
    }
}
