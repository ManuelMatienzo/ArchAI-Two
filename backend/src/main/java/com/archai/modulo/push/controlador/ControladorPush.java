package com.archai.modulo.push.controlador;

import com.archai.comun.excepcion.ExcepcionNegocio;
import com.archai.modulo.push.dto.AlertaPushDto;
import com.archai.modulo.push.dto.RegistroPushDto;
import com.archai.modulo.push.dto.ResultadoPushDto;
import com.archai.modulo.push.entidad.SuscripcionPush;
import com.archai.modulo.push.servicio.DespachadorExpoPush;
import com.archai.modulo.push.servicio.DespachadorFcmHttpV1;
import com.archai.modulo.push.servicio.ServicioNotificacionesPush;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CU-23 — API de notificaciones push.
 *
 * <p>El cliente móvil registra aquí su token FCM/Expo. Cualquier servicio interno (o la web
 * como anfitrión) puede disparar una alerta crítica contra una sala o proyecto. El despacho
 * usa FCM HTTP v1 cuando las credenciales de Firebase están configuradas; hasta entonces la
 * alerta queda registrada como "omitida" sin romper el flujo.</p>
 */
@RestController
@RequestMapping({"/api/v1/push", "/api/v1/notificaciones"})
@RequiredArgsConstructor
public class ControladorPush {

    private final ServicioNotificacionesPush servicioNotificacionesPush;
    private final DespachadorFcmHttpV1 despachadorFcm;
    private final DespachadorExpoPush despachadorExpo;

    /** CU-23 · Registra o actualiza el token del dispositivo móvil. */
    @PostMapping({"/register", "/registrar", "/suscribir"})
    public ResponseEntity<Map<String, Object>> registrar(@RequestBody RegistroPushDto solicitud) {
        SuscripcionPush suscripcion = servicioNotificacionesPush.registrar(solicitud);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("ok", true);
        respuesta.put("id", suscripcion.getId());
        respuesta.put("plataforma", suscripcion.getPlataforma() != null ? suscripcion.getPlataforma() : "mobile-react-native");
        return ResponseEntity.ok(respuesta);
    }

    /** CU-23 · Desactiva un token (logout o desactivación de notificaciones). */
    @PostMapping({"/unregister", "/desregistrar", "/baja"})
    public ResponseEntity<Map<String, Object>> desregistrar(
            @RequestBody(required = false) RegistroPushDto solicitud,
            @RequestParam(required = false) String token,
            @RequestParam(required = false) String usuarioId) {

        String tokenFinal = token;
        if ((tokenFinal == null || tokenFinal.isBlank()) && solicitud != null) {
            tokenFinal = solicitud.getToken();
        }
        String usuarioFinal = usuarioId;
        if ((usuarioFinal == null || usuarioFinal.isBlank()) && solicitud != null) {
            usuarioFinal = solicitud.getUsuarioId();
        }

        if (tokenFinal != null && !tokenFinal.isBlank()) {
            servicioNotificacionesPush.desactivar(tokenFinal);
        } else if (usuarioFinal != null && !usuarioFinal.isBlank()) {
            servicioNotificacionesPush.desactivarUsuario(usuarioFinal);
        } else {
            throw new ExcepcionNegocio("Se requiere token o usuarioId para desregistrar la suscripción push.");
        }

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("ok", true);
        return ResponseEntity.ok(respuesta);
    }

    /** CU-23 · Estado interno de la mensajería (sin exponer tokens ni credenciales). */
    @GetMapping("/estado")
    public ResponseEntity<Map<String, Object>> estado(@RequestParam(required = false) String usuarioId) {
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("activas", servicioNotificacionesPush.contarActivas(usuarioId));
        respuesta.put("fcmConfigurado", despachadorFcm.estaConfigurado());
        respuesta.put("expoDisponible", despachadorExpo.estaConfigurado());
        return ResponseEntity.ok(respuesta);
    }

    /** CU-23 · Despacha una alerta crítica a los dispositivos suscritos. */
    @PostMapping({"/alertas", "/alertas/critica", "/notificar"})
    public ResponseEntity<ResultadoPushDto> alertaCritica(@RequestBody AlertaPushDto solicitud) {
        return ResponseEntity.ok(servicioNotificacionesPush.enviarAlertaCritica(solicitud));
    }
}
