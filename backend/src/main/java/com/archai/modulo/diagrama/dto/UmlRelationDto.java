package com.archai.modulo.diagrama.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UmlRelationDto extends PropiedadesUmlDto {
    private String id;
    private String sourceClassId;
    private String targetClassId;
    private String type; // ASSOCIATION_1_1, ASSOCIATION_1_N, ASSOCIATION_N_M, INHERITANCE, COMPOSITION, AGGREGATION
    private String sourceMultiplicity;
    private String targetMultiplicity;
    private String sourceRole;
    private String targetRole;
    private String associationClassId;
}
