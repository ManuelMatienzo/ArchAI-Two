package com.archai.modulo.colaboracion.dto;

import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InfoSesionDto {

    private String diagramId;
    private String projectId;

    @JsonProperty("roomId")
    private String roomId;

    @JsonProperty("roomName")
    private String roomName;

    @JsonProperty("hostName")
    private String hostName;

    @JsonProperty("createdAt")
    private String createdAt;

    @JsonProperty("currentUser")
    private PerfilUsuarioDto currentUser;

    @JsonProperty("participants")
    private List<PerfilUsuarioDto> participants;

    @JsonProperty("isLocalMode")
    private boolean isLocalMode;
}
