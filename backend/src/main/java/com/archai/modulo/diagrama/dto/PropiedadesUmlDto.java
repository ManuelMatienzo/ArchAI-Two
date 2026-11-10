package com.archai.modulo.diagrama.dto;
import com.fasterxml.jackson.annotation.*;
import java.util.*;
public abstract class PropiedadesUmlDto {
    private final Map<String,Object> propiedades = new LinkedHashMap<>();
    @JsonAnySetter public void propiedad(String key,Object value) { propiedades.put(key,value); }
    @JsonAnyGetter public Map<String,Object> propiedades() { return propiedades; }
}
