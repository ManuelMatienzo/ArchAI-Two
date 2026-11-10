package com.archai.modulo.diagrama.dto;

import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UmlMethodDto extends PropiedadesUmlDto {
    private String id;
    private String name;
    private String returnType;
    private String visibility;
    private Object parameters;
}
