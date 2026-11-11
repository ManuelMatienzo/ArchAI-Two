package com.archai.modulo.ia.servicio;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

@Service
public class ClienteOllama {

    private final ObjectMapper mapper;
    private final String base;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public ClienteOllama(ObjectMapper mapper, Environment env) {
        this.mapper = mapper;
        base = env.getProperty("OLLAMA_BASE_URL", "http://127.0.0.1:11434").replaceAll("/$", "");
    }

    public List<String> modelos() {
        try {
            var res = http.send(
                HttpRequest.newBuilder(URI.create(base + "/api/tags"))
                    .timeout(Duration.ofSeconds(3))
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString()
            );
            if (res.statusCode() != 200) return List.of();
            List<String> names = new ArrayList<>();
            for (JsonNode n : mapper.readTree(res.body()).path("models")) names.add(n.path("name").asText());
            return names;
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            return List.of();
        }
    }

    public ClientePropuestasNube.Reply conversar(
        String model,
        String system,
        String prompt,
        boolean automatic,
        ObjectNode official
    ) {
        if (model.isBlank() || model.length() > 120) throw new ClientePropuestasNube.Fallo(
            "Selecciona un modelo local disponible.",
            false,
            422
        );
        ObjectNode body = mapper.createObjectNode().put("model", model).put("stream", false);
        if (model.startsWith("qwen3.5:")) body.put("think", false);
        body.set("format", ContratoConversacion.schema());
        body.putObject("options").put("temperature", 0.2).put("num_predict", 2048);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", system);
        messages.addObject().put("role", "user").put("content", prompt);
        long start = System.nanoTime();
        try {
            var res = http.send(
                HttpRequest.newBuilder(URI.create(base + "/api/chat"))
                    .timeout(Duration.ofSeconds(90))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build(),
                HttpResponse.BodyHandlers.ofString()
            );
            if (res.statusCode() != 200) throw new ClientePropuestasNube.Fallo(
                res.statusCode() == 404
                    ? "El modelo local no está instalado. Elige otro en las preferencias."
                    : "Ollama no pudo procesar la consulta. Revisa los recursos del equipo.",
                false,
                res.statusCode()
            );
            JsonNode data = mapper.readTree(res.body());
            ObjectNode content = (ObjectNode) mapper.readTree(data.path("message").path("content").asText());
            ContratoConversacion.validar(content, official, automatic);
            return new ClientePropuestasNube.Reply(
                content,
                "Ollama",
                model,
                (System.nanoTime() - start) / 1_000_000,
                data.path("prompt_eval_count").asLong(),
                data.path("eval_count").asLong()
            );
        } catch (ClientePropuestasNube.Fallo ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ClientePropuestasNube.Fallo("La consulta se canceló.", false, 499);
        } catch (Exception ex) {
            throw new ClientePropuestasNube.Fallo(
                "No se obtuvo una respuesta válida de Ollama. Comprueba que esté iniciado y vuelve a intentar.",
                false,
                503
            );
        }
    }

    public String contenido(String model, String system, String prompt, int tokens, boolean json) {
        ObjectNode body = mapper.createObjectNode().put("model", model).put("stream", false);
        if (json) body.put("format", "json");
        if (model.startsWith("qwen3.5:")) body.put("think", false);
        body.putArray("messages").addObject().put("role", "system").put("content", system);
        ((ArrayNode) body.path("messages")).addObject().put("role", "user").put("content", prompt);
        body.putObject("options").put("temperature", 0.2).put("num_predict", tokens);
        try {
            var res = http.send(
                HttpRequest.newBuilder(URI.create(base + "/api/chat"))
                    .timeout(Duration.ofSeconds(90))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                    .build(),
                HttpResponse.BodyHandlers.ofString()
            );
            if (res.statusCode() != 200) throw new ClientePropuestasNube.Fallo(
                "Ollama no pudo generar el contenido. Revisa el modelo seleccionado.",
                false,
                503
            );
            String text = mapper.readTree(res.body()).path("message").path("content").asText();
            if (text.isBlank()) throw new ClientePropuestasNube.Fallo(
                "Ollama devolvió una respuesta vacía.",
                false,
                422
            );
            return text;
        } catch (ClientePropuestasNube.Fallo ex) {
            throw ex;
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ClientePropuestasNube.Fallo("No se pudo conectar con el modelo local.", false, 503);
        }
    }
}
