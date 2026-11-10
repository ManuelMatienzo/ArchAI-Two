package com.archai.modulo.ia.controlador;

import com.archai.modulo.diagrama.dto.DiagramDto;
import com.archai.modulo.ia.servicio.ServicioVisionOcr;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * CU-07 — Digitalización de Pizarra por Foto (OCR).
 * Recibe la fotografía (JPEG/PNG) y devuelve un DiagramDto con clases UML inferidas.
 */
@RestController
@RequestMapping({ "/api/v1/ia", "/api/v1/ai" })
@RequiredArgsConstructor
public class ControladorVisionOcr {

    private final ServicioVisionOcr servicioVisionOcr;
    private final com.archai.modulo.colaboracion.servicio.ServicioConversacion chat;

    @PostMapping(
        value = { "/ocr-pizarra", "/ocr-whiteboard", "/pizarra/ocr" },
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<DiagramDto> procesarPizarra(
        @RequestParam("archivo") MultipartFile archivo,
        @RequestParam(value = "titulo", required = false) String titulo,
        @RequestParam(required = false) String roomId,
        @RequestParam(required = false) String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        if (
            roomId != null &&
            diagramId != null &&
            chat.configuracion(roomId, diagramId, auth).path("mode").asText().equals("local")
        ) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.CONFLICT,
            "El OCR de fotografías utiliza visión en nube. Cambia el motor de la sala a Nube para procesar la imagen."
        );
        return ResponseEntity.ok(servicioVisionOcr.procesarImagenPizarra(archivo, titulo));
    }
}
