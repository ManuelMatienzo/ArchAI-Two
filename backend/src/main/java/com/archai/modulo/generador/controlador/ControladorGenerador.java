package com.archai.modulo.generador.controlador;

import com.archai.comun.seguridad.AccesoProyecto;
import com.archai.modulo.diagrama.dto.DiagramDto;
import com.archai.modulo.generador.dto.GeneracionDto;
import com.archai.modulo.generador.dto.GeneratedFileDto;
import com.archai.modulo.generador.dto.ProjectGenerationResponseDto;
import com.archai.modulo.generador.dto.SolicitudImportacionXmiDto;
import com.archai.modulo.generador.servicio.*;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({ "/api/v1/generator", "/api/v1/generador" })
@RequiredArgsConstructor
public class ControladorGenerador {

  private final ServicioGeneradorSpringBoot generadorSpringBoot;
  private final ServicioGeneradorPostgresDdl generadorDdl;
  private final ServicioGeneradorPostman generadorPostman;
  private final ServicioXmi servicioXmi;
  private final ServicioExportacionZip servicioExportacionZip;
  private final ServicioImportacionXmi servicioImportacionXmi;
  private final ServicioHistorialGeneraciones servicioHistorial;
  private final AccesoProyecto acceso;

  @PostMapping({ "/preview", "/previsualizar", "/generate", "/generar" })
  public ResponseEntity<ProjectGenerationResponseDto> previewProject(
    @RequestBody DiagramDto diagram,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    diagram.setCreadorId(acceso.usuario(auth));
    List<GeneratedFileDto> springFiles =
      generadorSpringBoot.generateProjectFiles(diagram);
    String sqlDdl = generadorDdl.generateDdl(diagram);
    String postmanJson = generadorPostman.generateCollectionJson(diagram);
    String xmiContent = servicioXmi.exportXmi(diagram);

    ProjectGenerationResponseDto response =
      ProjectGenerationResponseDto.builder()
        .diagramTitle(
          diagram.getTitle() != null ? diagram.getTitle() : "ArchAI_Project"
        )
        .files(springFiles)
        .postgresDdl(sqlDdl)
        .postmanCollectionJson(postmanJson)
        .xmiContent(xmiContent)
        .message(
          "Proyecto generado con éxito según estándar UML 2.5 y Spring Boot 3."
        )
        .build();

    // CU-10..CU-14 · Trazabilidad del historial
    servicioHistorial.registrar(
      "SPRING_BOOT",
      diagram.getTitle(),
      (diagram.getTitle() != null ? diagram.getTitle() : "ArchAI_Backend") +
        ".zip",
      null,
      diagram.getCreadorId()
    );

    return ResponseEntity.ok(response);
  }

  @PostMapping(
    value = { "/zip", "/descargar-zip" },
    produces = "application/zip"
  )
  public ResponseEntity<byte[]> downloadProjectZip(
    @RequestBody DiagramDto diagram,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) throws IOException {
    diagram.setCreadorId(acceso.usuario(auth));
    byte[] zipBytes = servicioExportacionZip.createProjectZip(diagram);
    String filename =
      (diagram.getTitle() != null
        ? diagram.getTitle().replaceAll("[^a-zA-Z0-9_-]", "_")
        : "ArchAI_Project") + ".zip";

    // CU-14 · Trazabilidad del historial
    servicioHistorial.registrar(
      "ZIP",
      diagram.getTitle(),
      filename,
      (long) zipBytes.length,
      diagram.getCreadorId()
    );

    return ResponseEntity.ok()
      .header(
        HttpHeaders.CONTENT_DISPOSITION,
        "attachment; filename=\"" + filename + "\""
      )
      .contentType(MediaType.APPLICATION_OCTET_STREAM)
      .body(zipBytes);
  }

  @PostMapping(
    value = { "/sql", "/generar-sql" },
    produces = MediaType.TEXT_PLAIN_VALUE
  )
  public ResponseEntity<String> getPostgresDdl(
    @RequestBody DiagramDto diagram,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    diagram.setCreadorId(acceso.usuario(auth));
    String ddl = generadorDdl.generateDdl(diagram);
    servicioHistorial.registrar(
      "DDL",
      diagram.getTitle(),
      "schema_postgres.sql",
      (long) ddl.length(),
      diagram.getCreadorId()
    );
    return ResponseEntity.ok(ddl);
  }

  @PostMapping(
    value = { "/postman", "/generar-postman" },
    produces = MediaType.APPLICATION_JSON_VALUE
  )
  public ResponseEntity<String> getPostmanCollection(
    @RequestBody DiagramDto diagram,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    diagram.setCreadorId(acceso.usuario(auth));
    String collection = generadorPostman.generateCollectionJson(diagram);
    servicioHistorial.registrar(
      "POSTMAN",
      diagram.getTitle(),
      "postman_collection.json",
      (long) collection.length(),
      diagram.getCreadorId()
    );
    return ResponseEntity.ok(collection);
  }

  @PostMapping(
    value = { "/xmi", "/generar-xmi" },
    produces = MediaType.APPLICATION_XML_VALUE
  )
  public ResponseEntity<String> getXmiExport(
    @RequestBody DiagramDto diagram,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    diagram.setCreadorId(acceso.usuario(auth));
    String xmi = servicioXmi.exportXmi(diagram);
    servicioHistorial.registrar(
      "XMI",
      diagram.getTitle(),
      "model.xmi",
      (long) xmi.length(),
      diagram.getCreadorId()
    );
    return ResponseEntity.ok(xmi);
  }

  /** CU-13 · Importar un documento OMG XMI 2.1 y reconstruir el DiagramDto editable. */
  @PostMapping({ "/xmi/importar", "/importar-xmi", "/xmi/import" })
  public ResponseEntity<DiagramDto> importarXmi(
    @RequestBody SolicitudImportacionXmiDto solicitud
  ) {
    return ResponseEntity.ok(
      servicioImportacionXmi.importarXmi(
        solicitud.getXmiContent(),
        solicitud.getTitulo()
      )
    );
  }

  // ─────────────────────────── Historial de Generaciones (CU-10..CU-14) ───────────────────────────

  @GetMapping({ "/historial", "/history", "/generaciones" })
  public ResponseEntity<List<GeneracionDto>> getHistorial(
    @RequestParam(required = false) String tipo,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    return ResponseEntity.ok(
      servicioHistorial.listarParaUsuario(acceso.usuario(auth), tipo)
    );
  }

  @DeleteMapping("/historial/{id}")
  public ResponseEntity<Void> eliminarGeneracion(
    @PathVariable String id,
    @RequestHeader(value = "Authorization", required = false) String auth
  ) {
    servicioHistorial.eliminarPropia(id, acceso.usuario(auth));
    return ResponseEntity.noContent().build();
  }
}
