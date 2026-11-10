package com.archai.modulo.push.servicio;

/**
 * CU-23 — Contrato de un canal de despacho push.
 *
 * <p>La implementación FCM es la que el usuario activará al agregar las credenciales de
 * Firebase. El canal Expo permite probar el flujo completo sin credenciales cuando el
 * cliente obtiene un `ExponentPushToken`.</p>
 */
public interface DespachadorPush {

    /** Nombre corto del canal (FCM, EXPO). */
    String canal();

    /** Indica si este canal puede enviar al token recibido. */
    boolean soporta(String token);

    /** Indica si el canal tiene credenciales/configuración válidas. */
    boolean estaConfigurado();

    /** Envía el mensaje. Devuelve true solo si el proveedor aceptó el envío. */
    boolean despachar(String token, MensajePush mensaje);
}
