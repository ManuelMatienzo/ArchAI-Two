package com.archai.modulo.push.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * CU-23 — Cuerpo de `POST /api/v1/push/register`.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegistroPushDto {

    /** Token FCM o ExponentPushToken entregado por el dispositivo. */
    private String token;

    private String usuarioId;
    private String salaId;
    private String proyectoId;
    private String plataforma;
    private String dispositivo;
}
