package com.archai;

import com.archai.modulo.diagrama.dto.*;
import com.archai.modulo.generador.dto.GeneratedFileDto;
import com.archai.modulo.generador.servicio.ServicioExportacionZip;
import com.archai.modulo.generador.servicio.ServicioGeneradorPostgresDdl;
import com.archai.modulo.generador.servicio.ServicioGeneradorPostman;
import com.archai.modulo.generador.servicio.ServicioGeneradorSpringBoot;
import com.archai.modulo.generador.servicio.ServicioXmi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class PruebaGeneracionEnVivoTest {

    private final ServicioGeneradorSpringBoot generadorSpringBoot = new ServicioGeneradorSpringBoot();
    private final ServicioGeneradorPostgresDdl generadorDdl = new ServicioGeneradorPostgresDdl();
    private final ServicioGeneradorPostman generadorPostman = new ServicioGeneradorPostman();
    private final ServicioXmi generadorXmi = new ServicioXmi();

    @Test
    @DisplayName("Generación Completa en Vivo: Diagrama UML -> Backend Spring Boot 3 + DDL + Postman + XMI")
    void probarGeneracionBackendCompleta() throws IOException {
        // 1. Construir Diagrama con todas las herramientas de ArchAI CASE
        DiagramDto diagrama = crearDiagramaClinico();

        // 2. Generar Archivos del Backend Spring Boot 3
        List<GeneratedFileDto> archivosBackend = generadorSpringBoot.generateProjectFiles(diagrama);
        assertThat(archivosBackend).isNotEmpty();
        System.out.println(">>> ArchAI CASE Engine: " + archivosBackend.size() + " archivos generados para Spring Boot 3.");

        // 3. Generar Script SQL DDL (PostgreSQL / Supabase 3FN)
        String scriptSql = generadorDdl.generateDdl(diagrama);
        assertThat(scriptSql).contains("CREATE TABLE");

        // 4. Generar Colección Postman v2.1
        String postmanJson = generadorPostman.generateCollectionJson(diagrama);
        assertThat(postmanJson).contains("info").contains("item");

        // 5. Generar XMI 2.1 OMG (Enterprise Architect)
        String xmiXml = generadorXmi.exportXmi(diagrama);
        assertThat(xmiXml).contains("xmi:XMI").contains("uml:Model");

        // 6. Guardar en disco para inspección física
        Path outDir = Paths.get("C:\\Users\\HP\\.gemini\\antigravity\\brain\\e4f33697-79d8-48c1-a369-e09f5309d98a\\scratch\\backend_generado_clinica");
        Files.createDirectories(outDir);

        for (GeneratedFileDto file : archivosBackend) {
            Path targetFile = outDir.resolve(file.getPath());
            Files.createDirectories(targetFile.getParent());
            Files.writeString(targetFile, file.getContent());
            System.out.println("  + Generado: " + file.getPath() + " (" + file.getLanguage() + ")");
        }

        Files.writeString(outDir.resolve("schema_clinica.sql"), scriptSql);
        Files.writeString(outDir.resolve("coleccion_clinica_postman.json"), postmanJson);
        Files.writeString(outDir.resolve("modelo_clinica_ea.xmi"), xmiXml);

        System.out.println(">>> PROYECTO GENERADO EXITOSAMENTE EN: " + outDir.toAbsolutePath());

        // Verificaciones de Arquitectura en 4 Capas
        long countControllers = archivosBackend.stream().filter(f -> f.getFilename().endsWith("Controller.java")).count();
        long countServices = archivosBackend.stream().filter(f -> f.getFilename().endsWith("Service.java")).count();
        long countRepositories = archivosBackend.stream().filter(f -> f.getFilename().endsWith("Repository.java")).count();
        long countEntities = archivosBackend.stream().filter(f -> f.getPath().contains("domain/entity/")).count();

        assertThat(countControllers).isEqualTo(4);
        assertThat(countServices).isEqualTo(4);
        assertThat(countRepositories).isEqualTo(4);
        assertThat(countEntities).isEqualTo(4);

        System.out.println(">>> VALIDACIÓN DE CAPAS EXITOSA:");
        System.out.println("    - Entidades JPA: " + countEntities);
        System.out.println("    - Repositorios Spring Data: " + countRepositories);
        System.out.println("    - Servicios de Negocio: " + countServices);
        System.out.println("    - Controladores REST: " + countControllers);
        System.out.println("    - Archivos de Configuración: pom.xml, application.properties, Application.java, CorsConfig, GlobalExceptionHandler, OpenApiConfig");
    }

    private DiagramDto crearDiagramaClinico() {
        // Clase 1: Paciente
        UmlClassDto paciente = UmlClassDto.builder()
                .id("cls-paciente")
                .name("Paciente")
                .stereotype("Entity")
                .position(new PositionDto(100.0, 100.0))
                .attributes(List.of(
                        UmlAttributeDto.builder().id("a-p1").name("id").type("Long").visibility("+").isPrimaryKey(true).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-p2").name("nombreCompleto").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-p3").name("ci").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-p4").name("fechaNacimiento").type("LocalDate").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-p5").name("telefono").type("String").visibility("+").isPrimaryKey(false).isNullable(true).build(),
                        UmlAttributeDto.builder().id("a-p6").name("alergias").type("String").visibility("+").isPrimaryKey(false).isNullable(true).build()
                ))
                .methods(List.of(
                        com.archai.modulo.diagrama.dto.UmlMethodDto.builder().id("m-p1").name("registrarAlergia").returnType("void").visibility("+").parameters(new ArrayList<>()).build()
                ))
                .build();

        // Clase 2: Medico
        UmlClassDto medico = UmlClassDto.builder()
                .id("cls-medico")
                .name("Medico")
                .stereotype("Entity")
                .position(new PositionDto(500.0, 100.0))
                .attributes(List.of(
                        UmlAttributeDto.builder().id("a-m1").name("id").type("Long").visibility("+").isPrimaryKey(true).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-m2").name("nombreCompleto").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-m3").name("matriculaProfesional").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-m4").name("especialidad").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-m5").name("correo").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-m6").name("disponible").type("Boolean").visibility("+").isPrimaryKey(false).isNullable(false).build()
                ))
                .methods(List.of(
                        com.archai.modulo.diagrama.dto.UmlMethodDto.builder().id("m-m1").name("programarGuardia").returnType("Boolean").visibility("+").parameters(new ArrayList<>()).build()
                ))
                .build();

        // Clase 3: ConsultaMedica
        UmlClassDto consulta = UmlClassDto.builder()
                .id("cls-consulta")
                .name("ConsultaMedica")
                .stereotype("Entity")
                .position(new PositionDto(100.0, 450.0))
                .attributes(List.of(
                        UmlAttributeDto.builder().id("a-c1").name("id").type("Long").visibility("+").isPrimaryKey(true).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-c2").name("fechaHora").type("LocalDateTime").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-c3").name("motivo").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-c4").name("diagnosticoPreliminar").type("String").visibility("+").isPrimaryKey(false).isNullable(true).build(),
                        UmlAttributeDto.builder().id("a-c5").name("costo").type("BigDecimal").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-c6").name("estado").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build()
                ))
                .methods(List.of(
                        com.archai.modulo.diagrama.dto.UmlMethodDto.builder().id("m-c1").name("finalizarConsulta").returnType("void").visibility("+").parameters(new ArrayList<>()).build()
                ))
                .build();

        // Clase 4: RecetaMedica
        UmlClassDto receta = UmlClassDto.builder()
                .id("cls-receta")
                .name("RecetaMedica")
                .stereotype("Entity")
                .position(new PositionDto(500.0, 450.0))
                .attributes(List.of(
                        UmlAttributeDto.builder().id("a-r1").name("id").type("Long").visibility("+").isPrimaryKey(true).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-r2").name("codigoReceta").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-r3").name("indicaciones").type("String").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-r4").name("vigenteHasta").type("LocalDate").visibility("+").isPrimaryKey(false).isNullable(false).build(),
                        UmlAttributeDto.builder().id("a-r5").name("dispensada").type("Boolean").visibility("+").isPrimaryKey(false).isNullable(false).build()
                ))
                .methods(List.of(
                        com.archai.modulo.diagrama.dto.UmlMethodDto.builder().id("m-r1").name("dispensarMedicamentos").returnType("Boolean").visibility("+").parameters(new ArrayList<>()).build()
                ))
                .build();

        // Relaciones UML
        List<UmlRelationDto> relaciones = List.of(
                // Paciente (1) -> (*) ConsultaMedica
                UmlRelationDto.builder()
                        .id("rel-paciente-consulta")
                        .sourceClassId("cls-paciente")
                        .targetClassId("cls-consulta")
                        .type("ASSOCIATION_1_N")
                        .sourceMultiplicity("1")
                        .targetMultiplicity("*")
                        .sourceRole("paciente")
                        .targetRole("consultas")
                        .build(),

                // Medico (1) -> (*) ConsultaMedica
                UmlRelationDto.builder()
                        .id("rel-medico-consulta")
                        .sourceClassId("cls-medico")
                        .targetClassId("cls-consulta")
                        .type("ASSOCIATION_1_N")
                        .sourceMultiplicity("1")
                        .targetMultiplicity("*")
                        .sourceRole("medico")
                        .targetRole("consultas")
                        .build(),

                // ConsultaMedica (1) -> (*) RecetaMedica (Composición)
                UmlRelationDto.builder()
                        .id("rel-consulta-receta")
                        .sourceClassId("cls-consulta")
                        .targetClassId("cls-receta")
                        .type("COMPOSITION")
                        .sourceMultiplicity("1")
                        .targetMultiplicity("1..*")
                        .sourceRole("consulta")
                        .targetRole("recetas")
                        .build()
        );

        return DiagramDto.builder()
                .title("SistemaClinicoArchAI")
                .classes(List.of(paciente, medico, consulta, receta))
                .relations(relaciones)
                .build();
    }
}
