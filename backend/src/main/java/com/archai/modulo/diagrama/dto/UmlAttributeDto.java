package com.archai.modulo.diagrama.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UmlAttributeDto extends PropiedadesUmlDto {
    private String id;
    private String name;
    private String type;
    private String visibility;
    @JsonProperty("isPrimaryKey")
    private boolean isPrimaryKey;
    @JsonProperty("isNullable")
    private boolean isNullable;
    @JsonProperty("isUnique")
    private Boolean isUnique;
}
