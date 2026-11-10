package com.archai.modulo.push.servicio;

import java.util.Map;

/**
 * CU-23 — Mensaje normalizado que recibe cualquier despachador push.
 */
public record MensajePush(
        String titulo,
        String cuerpo,
        String tipo,
        Map<String, String> datos
) {
}
