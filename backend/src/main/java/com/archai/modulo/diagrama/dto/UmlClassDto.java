package com.archai.modulo.diagrama.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UmlClassDto extends PropiedadesUmlDto {
    private String id;
    private String name;
    private String stereotype;
    private PositionDto position;
    private List<UmlAttributeDto> attributes;
    private List<UmlMethodDto> methods;
}
