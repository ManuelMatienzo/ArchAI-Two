package com.archai.modulo.proyecto.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

/** CU-02 · Solicitud para unirse a un proyecto compartido mediante su código de acceso. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UnirseProyectoSolicitudDto {

    @JsonProperty("codigoAcceso")
    private String codigoAcceso;

    @JsonProperty("usuarioId")
    private String usuarioId;

    @JsonProperty("correoOUsuario")
    private String correoOUsuario;
}
