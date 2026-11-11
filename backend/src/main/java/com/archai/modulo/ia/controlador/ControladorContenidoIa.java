package com.archai.modulo.ia.controlador;

import com.archai.modulo.colaboracion.servicio.*;
import com.archai.modulo.ia.servicio.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Compatibility adapter for cycle-one generators; all secrets and engine selection stay server-side. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/ia")
public class ControladorContenidoIa {

    private final ServicioRevisionPropuesta reviews;
    private final ServicioConversacion chat;
    private final ClientePropuestasNube cloud;
    private final ClienteOllama local;
    private final GatewayPropuestasNube gateway;

    private String[] engine(String auth, String room, String id) {
        try {
            if (auth != null && !auth.isBlank()) {
                reviews.usuario(auth);
                if (room != null && id != null && !id.isBlank()) {
                    ObjectNode cfg = chat.configuracion(room, id, auth);
                    return new String[] { cfg.path("mode").asText("cloud"), cfg.path("model").asText(cloud.model(false)) };
                }
            }
        } catch (Exception ignored) {}
        return new String[] { "cloud", cloud.model(false) };
    }

    @GetMapping("/motor")
    public Map<String, Object> motor(
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestParam(required = false) String roomId,
        @RequestParam(required = false) String diagramId
    ) {
        String[] engine = engine(auth, roomId, diagramId);
        boolean isLocal = "local".equalsIgnoreCase(engine[0]);
        List<String> models = isLocal ? local.modelos() : List.of(cloud.model(false));
        boolean localOnline = isLocal && models.contains(engine[1]);
        boolean cloudOnline = cloud.configured(false) || cloud.fallback();

        if (isLocal && !localOnline && cloudOnline) {
            engine[0] = "cloud";
            engine[1] = cloud.model(false);
            models = List.of(cloud.model(false));
        }

        return Map.of(
            "mode",
            engine[0],
            "model",
            "local".equalsIgnoreCase(engine[0]) ? engine[1] : cloud.model(false),
            "models",
            models,
            "online",
            "local".equalsIgnoreCase(engine[0]) ? models.contains(engine[1]) : cloudOnline
        );
    }

    @PostMapping("/contenido")
    public Map<String, String> contenido(
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) {
        String[] engine = engine(auth, body.path("roomId").asText(null), body.path("diagramId").asText(null));
        String prompt = body.path("prompt").asText(),
            system = body.path("systemPrompt").asText();
        if (prompt.isBlank() || prompt.length() + system.length() > 200000) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "La consulta está vacía o es demasiado grande."
        );
        int tokens = Math.min(8192, Math.max(256, body.path("maxOutputTokens").asInt(2048)));
        boolean json = body.path("json").asBoolean();
        try {
            var reply = gateway.contenido(engine[0], engine[1], system, prompt, tokens, json);
            return Map.of(
                "text",
                reply.content().path("text").asText(),
                "provider",
                reply.provider(),
                "model",
                reply.model()
            );
        } catch (ClientePropuestasNube.Fallo ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage());
        }
    }
}
