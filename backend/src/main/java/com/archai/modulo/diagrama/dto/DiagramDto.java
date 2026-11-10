package com.archai.modulo.diagrama.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagramDto extends PropiedadesUmlDto {
    private String id;

    @JsonProperty("proyectoId")
    @JsonAlias({"projectId", "idProyecto"})
    private String proyectoId;

    @JsonProperty("creadorId")
    @JsonAlias({"creatorId", "userId", "idCreador"})
    private String creadorId;

    private String title;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<UmlClassDto> classes;
    private List<UmlRelationDto> relations;
}
