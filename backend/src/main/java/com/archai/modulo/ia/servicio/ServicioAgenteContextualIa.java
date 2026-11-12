package com.archai.modulo.ia.servicio;

import com.archai.modulo.diagrama.dto.PositionDto;
import com.archai.modulo.diagrama.dto.UmlAttributeDto;
import com.archai.modulo.diagrama.dto.UmlClassDto;
import com.archai.modulo.diagrama.dto.UmlRelationDto;
import com.archai.modulo.ia.dto.ConsultaContextualSolicitudDto;
import com.archai.modulo.ia.dto.RespuestaContextualDto;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * CU-08 — Asistencia con Agente IA Contextual.
 * Analiza el modelo UML actual (clases, atributos y relaciones) y responde con:
 *  - Validaciones y alertas (duplicados, sin PK, relaciones rotas, modelo vacío).
 *  - Sugerencias de mejora (estándares UML 2.5, nomenclatura, versionado).
 *  - Generación de clases cuando el usuario lo solicita por lenguaje natural.
 *  Inspirado en el patrón de "AI Advisor + Tools" del backend drawio de referencia.
 */
@Service
public class ServicioAgenteContextualIa {

    public RespuestaContextualDto analizar(ConsultaContextualSolicitudDto solicitud) {
        String mensaje = solicitud.getMensaje() != null ? solicitud.getMensaje().toLowerCase() : "";
        List<UmlClassDto> clases = solicitud.getClasesActuales() != null
                ? solicitud.getClasesActuales()
                : new ArrayList<>();
        List<UmlRelationDto> relaciones = solicitud.getRelacionesActuales() != null
                ? solicitud.getRelacionesActuales()
                : new ArrayList<>();

        List<String> alertas = new ArrayList<>();
        List<String> sugerencias = new ArrayList<>();
        List<UmlClassDto> clasesSugeridas = new ArrayList<>();
        List<UmlRelationDto> relacionesSugeridas = new ArrayList<>();

        // ── 1. Validación estructural del modelo ─────────────────────────────
        if (clases.isEmpty()) {
            alertas.add("El modelo está vacío. Comience creando al menos una clase con su clave primaria (id Long).");
        } else {
            // Duplicados por nombre
            Map<String, Long> porNombre = clases.stream()
                    .collect(Collectors.groupingBy(c -> c.getName().toLowerCase(Locale.ROOT), Collectors.counting()));
            porNombre.forEach((nombre, cantidad) -> {
                if (cantidad > 1) {
                    alertas.add("Se encontraron " + cantidad + " clases con el mismo nombre '" + nombre + "'. Renombre las duplicadas para evitar ambigüedad.");
                }
            });

            // Clases sin PK
            long sinPk = clases.stream()
                    .filter(c -> c.getAttributes() == null
                            || c.getAttributes().stream().noneMatch(a -> a.isPrimaryKey()))
                    .count();
            if (sinPk > 0) {
                alertas.add(sinPk + " clase(s) no declaran clave primaria. Agregue un atributo marcado como <<PK>> (ej. id Long).");
            }

            // Nomenclatura PascalCase
            for (UmlClassDto c : clases) {
                String nombre = c.getName();
                if (nombre != null && !nombre.isEmpty() && !Character.isUpperCase(nombre.charAt(0))) {
                    sugerencias.add("La clase '" + nombre + "' no sigue la convención PascalCase. Iníciela con mayúscula.");
                }
                if (nombre != null && (nombre.contains(" ") || nombre.contains("_"))) {
                    sugerencias.add("El nombre '" + nombre + "' contiene espacios o guiones bajos. Use CamelCase (ej. OrdenDeCompra).");
                }
            }
        }

        // Relaciones rotas
        Set<String> idsClases = clases.stream().map(UmlClassDto::getId).collect(Collectors.toSet());
        for (UmlRelationDto r : relaciones) {
            if (!idsClases.contains(r.getSourceClassId()) || !idsClases.contains(r.getTargetClassId())) {
                alertas.add("Existe una relación cuyo origen o destino apunta a una clase inexistente (¿fue eliminada?). Revise el conector '" + r.getId() + "'.");
            }
        }

        // Sugerencia de versionado (CU-05)
        if (!clases.isEmpty()) {
            sugerencias.add("Utilice el botón 'Guardar en la nube' para persistir el modelo y crear versiones recuperables.");
        }

        // ── 2. Respuesta a la intención del usuario ──────────────────────────
        String accion = "";

        if (contieneAlguno(mensaje, "resumen", "¿qué hay", "que hay", "estado del modelo", "resume")) {
            accion = "RESUMEN_MODELO";
            int totalAtributos = clases.stream()
                    .mapToInt(c -> c.getAttributes() != null ? c.getAttributes().size() : 0)
                    .sum();
            String resumen = "El modelo actual contiene " + clases.size() + " clase(s) con " + totalAtributos
                    + " atributos y " + relaciones.size() + " relación(es).";
            if (clases.isEmpty()) {
                resumen += " Aún no hay clases modeladas.";
            } else {
                resumen += " Clases: " + clases.stream().map(UmlClassDto::getName).collect(Collectors.joining(", ")) + ".";
            }
            return RespuestaContextualDto.builder()
                    .success(true)
                    .respuesta(resumen)
                    .alertas(alertas)
                    .sugerencias(sugerencias)
                    .accionEjecutable(accion)
                    .build();
        }

        if (contieneAlguno(mensaje, "recomienda", "sugerencia", "mejora", "cómo mejoro", "mejorar")) {
            accion = "RECOMENDACIONES";
            return RespuestaContextualDto.builder()
                    .success(true)
                    .respuesta("Recomendaciones del agente:\n- " + String.join("\n- ", sugerencias.isEmpty()
                            ? List.of("Modelo en buen estado. Considere agregar relaciones de composición y herencia para enriquecer el diseño.")
                            : sugerencias))
                    .alertas(alertas)
                    .sugerencias(sugerencias)
                    .accionEjecutable(accion)
                    .build();
        }

        // Generación de clases por lenguaje natural
        if (contieneAlguno(mensaje, "crear clase", "crea la clase", "nueva entidad", "crear entidad", "agrega una clase")) {
            accion = "CREAR_CLASES";
            clasesSugeridas = parsearClasesDesdeMensaje(solicitud.getMensaje(), clases.size());
            String nombres = clasesSugeridas.stream().map(UmlClassDto::getName).collect(Collectors.joining(", "));
            return RespuestaContextualDto.builder()
                    .success(true)
                    .respuesta("El agente contextual preparó " + clasesSugeridas.size() + " clase(s): " + nombres
                            + ". Revise la vista previa y confirme para insertarlas en el lienzo.")
                    .alertas(alertas)
                    .sugerencias(sugerencias)
                    .clasesSugeridas(clasesSugeridas)
                    .relacionesSugeridas(relacionesSugeridas)
                    .accionEjecutable(accion)
                    .build();
        }

        // Consulta genérica: diagnóstico por defecto
        accion = "DIAGNOSTICO";
        String respuesta = "Analicé el modelo en su contexto actual. " + resumenEstructura(clases, relaciones);
        if (alertas.isEmpty()) {
            respuesta += " No se detectaron problemas estructurales. Puede continuar con la generación de código.";
        } else {
            respuesta += " Se detectaron " + alertas.size() + " advertencia(s) que conviene revisar.";
        }

        return RespuestaContextualDto.builder()
                .success(true)
                .respuesta(respuesta)
                .alertas(alertas)
                .sugerencias(sugerencias)
                .clasesSugeridas(clasesSugeridas)
                .relacionesSugeridas(relacionesSugeridas)
                .accionEjecutable(accion)
                .build();
    }

    private String resumenEstructura(List<UmlClassDto> clases, List<UmlRelationDto> relaciones) {
        if (clases.isEmpty()) {
            return "El lienzo está vacío: 0 clases y 0 relaciones.";
        }
        return "Tiene " + clases.size() + " clase(s) (" + clases.stream().map(UmlClassDto::getName).collect(Collectors.joining(", "))
                + ") y " + relaciones.size() + " relación(es).";
    }

    private boolean contieneAlguno(String texto, String... palabras) {
        for (String p : palabras) {
            if (texto.contains(p)) {
                return true;
            }
        }
        return false;
    }

    // ── Parseo de clases desde instrucción en lenguaje natural ──────────────
    private List<UmlClassDto> parsearClasesDesdeMensaje(String mensaje, int indiceBase) {
        List<UmlClassDto> clases = new ArrayList<>();
        if (mensaje == null || mensaje.isBlank()) {
            return clases;
        }

        // Detectar frases "clase X" y "entidad X"
        Pattern patron = Pattern.compile("(?:clase|entidad)\\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = patron.matcher(mensaje);
        Set<String> yaVistas = new HashSet<>();
        int contador = 0;

        while (matcher.find() && contador < 4) {
            String nombre = matcher.group(1);
            if (yaVistas.contains(nombre.toLowerCase(Locale.ROOT))
                    || "de".equalsIgnoreCase(nombre) || "con".equalsIgnoreCase(nombre)) {
                continue;
            }
            yaVistas.add(nombre.toLowerCase(Locale.ROOT));
            String nombreCapitalizado = Character.toUpperCase(nombre.charAt(0)) + nombre.substring(1);

            UmlClassDto clase = UmlClassDto.builder()
                    .id("ag-cls-" + UUID.randomUUID())
                    .name(nombreCapitalizado)
                    .stereotype("Entity")
                    .position(new PositionDto(220.0 + contador * 260.0, 160.0 + indiceBase * 60.0))
                    .attributes(List.of(
                            UmlAttributeDto.builder().id("ag-" + UUID.randomUUID()).name("id").type("Long").visibility("+").isPrimaryKey(true).isNullable(false).build(),
                            UmlAttributeDto.builder().id("ag-" + UUID.randomUUID()).name("nombre").type("String").visibility("+").isPrimaryKey(false).isNullable(true).build()
                    ))
                    .methods(new ArrayList<>())
                    .build();
            clases.add(clase);
            contador++;
        }

        return clases;
    }
}