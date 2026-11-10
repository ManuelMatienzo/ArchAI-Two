package com.archai.modulo.push.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * CU-23 — Resultado del despacho de una alerta.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResultadoPushDto {

    private int total;
    private int enviados;
    private int fallidos;
    private int omitidos;
    private boolean fcmConfigurado;
    private boolean expoDisponible;
    private List<String> detalles;
}
