package com.archai.modulo.ia.servicio;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class ClientePropuestasNube {

    private final Environment env;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    public ClientePropuestasNube(Environment env, ObjectMapper mapper) {
        this.env = env;
        this.mapper = mapper;
    }

    public static class Fallo extends RuntimeException {

        public final boolean fallback;
        public final int status;

        public Fallo(String message, boolean fallback, int status) {
            super(message);
            this.fallback = fallback;
            this.status = status;
        }
    }

    public record Reply(
        ObjectNode content,
        String provider,
        String model,
        long durationMs,
        long inputTokens,
        long outputTokens
    ) {}

    public String model(boolean claude) {
        return env.getProperty(
            claude ? "ANTHROPIC_MODEL" : "GEMINI_MODEL",
            claude ? "claude-sonnet-5-5" : "gemini-3.8-flash"
        );
    }

    public boolean configured(boolean claude) {
        return !env.getProperty(claude ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY", "").isBlank();
    }

    public boolean fallback() {
        return env.getProperty("ARCHAI_CLAUDE_FALLBACK_ENABLED", Boolean.class, false) && configured(true);
    }

    public boolean testControls() {
        return (
            env.acceptsProfiles(org.springframework.core.env.Profiles.of("local-test")) &&
            env.getProperty("ARCHAI_AI_TEST_CONTROLS", Boolean.class, false)
        );
    }

    public Reply generate(boolean claude, String system, String prompt, boolean automatic, ObjectNode diagram) {
        return generate(claude, system, prompt, automatic, diagram, false);
    }

    public Reply generateConversation(
        boolean claude,
        String system,
        String prompt,
        boolean automatic,
        ObjectNode diagram
    ) {
        return generate(claude, system, prompt, automatic, diagram, true);
    }

    public Reply generateRaw(boolean claude, String system, String prompt, int tokens, boolean json) {
        return generate(claude, system, prompt, false, mapper.createObjectNode(), false, true, tokens, json);
    }

    private Reply generate(
        boolean claude,
        String system,
        String prompt,
        boolean automatic,
        ObjectNode diagram,
        boolean conversation
    ) {
        return generate(claude, system, prompt, automatic, diagram, conversation, false, 2048, true);
    }

    private Reply generate(
        boolean claude,
        String system,
        String prompt,
        boolean automatic,
        ObjectNode diagram,
        boolean conversation,
        boolean raw,
        int tokens,
        boolean json
    ) {
        String provider = claude ? "Claude" : "Gemini",
            model = model(claude);
        if (!configured(claude)) throw new Fallo(
            "Configura " + provider + " en el servidor antes de usar este modo.",
            !claude,
            0
        );
        ObjectNode payload = mapper.createObjectNode();
        String endpoint;
        if (claude) {
            endpoint = env.getProperty("archai.ia.claude-url", "https://api.anthropic.com/v1/messages");
            payload.put("model", model).put("max_tokens", tokens).put("system", system);
            payload.putArray("messages").addObject().put("role", "user").put("content", prompt);
            payload.putObject("thinking").put("type", "between_tools");
            ObjectNode output = payload.putObject("output_config").put("effort", "medium");
            if (!raw) output
                .putObject("format")
                .put("type", "json_schema")
                .set("schema", conversation ? ContratoConversacion.schema() : ContratoPropuestaNube.schema());
        } else {
            endpoint = env.getProperty(
                "archai.ia.gemini-url",
                "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"
            );
            payload.putObject("systemInstruction").putArray("parts").addObject().put("text", system);
            payload
                .putArray("contents")
                .addObject()
                .put("role", "user")
                .putArray("parts")
                .addObject()
                .put("text", prompt);
            ObjectNode config = payload
                .putObject("generationConfig")
                .put("temperature", 0.2)
                .put("maxOutputTokens", tokens);
            if (!raw || json) config.put("responseMimeType", "application/json");
            if (!raw) config.set(
                "responseJsonSchema",
                conversation ? ContratoConversacion.schema() : ContratoPropuestaNube.schema()
            );
            if (model.startsWith("gemini-3")) config.putObject("thinkingConfig").put("thinkingLevel", "low");
        }
        long start = System.nanoTime();
        try {
            int timeout = env.getProperty(
                claude ? "archai.ia.claude-timeout-seconds" : "archai.ia.gemini-timeout-seconds",
                Integer.class,
                claude ? 30 : 20
            );
            var request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofSeconds(timeout))
                .header("Content-Type", "application/json");
            String key = env.getProperty(claude ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY", "");
            if (claude) {
                request.header("Authorization", "Bearer " + key).header("anthropic-version", "2026-10-21");
                String workspace = env.getProperty("ANTHROPIC_WORKSPACE_ID", "");
                if (!workspace.isBlank()) request.header("anthropic-workspace-id", workspace);
            } else request.header("x-goog-api-key", key);
            var response = http.send(
                request.POST(HttpRequest.BodyPublishers.ofString(payload.toString())).build(),
                HttpResponse.BodyHandlers.ofString()
            );
            int status = response.statusCode();
            if (status < 200 || status >= 300) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn(
                    "Proveedor IA no disponible: proveedor={}, modelo={}, HTTP={}",
                    provider,
                    model,
                    status
                );
                String reason =
                    status == 429
                        ? " alcanzó su cuota de solicitudes."
                        : status == 401 || status == 403
                          ? " rechazó la clave o sus permisos."
                          : status == 404
                            ? " no tiene disponible el modelo configurado."
                            : status == 400
                              ? " rechazó la configuración de la solicitud."
                              : " no está disponible temporalmente.";
                throw new Fallo(provider + reason, status == 429 || status >= 500, status);
            }
            JsonNode data = mapper.readTree(response.body());
            StringBuilder text = new StringBuilder();
            if (claude) {
                if ("refusal".equals(data.path("stop_reason").asText())) throw new Fallo(
                    "Claude no puede responder a esta solicitud.",
                    false,
                    422
                );
                if ("max_tokens".equals(data.path("stop_reason").asText())) throw new Fallo(
                    "Claude devolvió una respuesta incompleta. Pide una propuesta más breve.",
                    false,
                    422
                );
                for (JsonNode block : data.path("content"))
                    if ("text".equals(block.path("type").asText())) text.append(block.path("text").asText());
            } else {
                JsonNode candidate = data.path("candidates").path(0);
                if (
                    !data.path("promptFeedback").path("blockReason").asText().isEmpty() ||
                    java.util.Set.of("SAFETY", "PROHIBITED_CONTENT", "RECITATION").contains(
                        candidate.path("finishReason").asText()
                    )
                ) throw new Fallo("Gemini no puede responder a esta solicitud.", false, 422);
                for (JsonNode block : candidate.path("content").path("parts"))
                    if (!block.path("thought").asBoolean()) text.append(block.path("text").asText());
            }
            if (text.toString().isBlank()) throw new Fallo(provider + " devolvió una respuesta vacía.", true, 422);
            if (raw && json) mapper.readTree(text.toString().strip().replaceAll("(?s)^```(?:json)?\\s*|\\s*```$", ""));
            ObjectNode content = raw
                ? mapper.createObjectNode().put("text", text.toString())
                : (ObjectNode) mapper.readTree(text.toString());
            if (!raw) {
                if (conversation) ContratoConversacion.validar(content, diagram, automatic);
                else ContratoPropuestaNube.validarRespuesta(content, diagram, automatic);
            }
            JsonNode usage = data.path(claude ? "usage" : "usageMetadata");
            return new Reply(
                content,
                provider,
                model,
                (System.nanoTime() - start) / 1_000_000,
                usage.path(claude ? "input_tokens" : "promptTokenCount").asLong(),
                usage.path(claude ? "output_tokens" : "candidatesTokenCount").asLong() +
                    usage.path("thoughtsTokenCount").asLong()
            );
        } catch (Fallo ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new Fallo("La consulta se canceló.", false, 499);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new Fallo(provider + " devolvió un JSON inválido. Intenta una propuesta más breve.", true, 422);
        } catch (java.io.IOException ex) {
            throw new Fallo(provider + " no respondió a tiempo o perdió la conexión.", true, 503);
        } catch (RuntimeException ex) {
            String detail =
                ex instanceof org.springframework.web.server.ResponseStatusException r
                    ? r.getReason()
                    : ex.getClass().getSimpleName();
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Propuesta inválida de {}: {}", provider, detail);
            throw new Fallo(provider + " devolvió una propuesta inválida. Intenta una consulta más breve.", true, 422);
        }
    }
}
