package com.archai.modulo.push.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * CU-23 — Alerta crítica a despachar.
 *
 * <p>Si se envían `usuarioIds`, la alerta se dirige solo a esos usuarios. Si no, se dirige
 * a los dispositivos suscritos a la `salaId` o al `proyectoId` indicado. Sin filtros,
 * se envía a todas las suscripciones activas.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertaPushDto {

    private String titulo;
    private String cuerpo;
    private String tipo;
    private String salaId;
    private String proyectoId;
    private List<String> usuarioIds;
    private Map<String, String> datos;
}
