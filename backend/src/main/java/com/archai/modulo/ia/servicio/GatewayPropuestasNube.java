package com.archai.modulo.ia.servicio;

import com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import java.util.concurrent.*;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GatewayPropuestasNube {

    private final ClientePropuestasNube client;
    private final ServicioRevisionPropuesta reviews;
    private final ObjectMapper mapper;
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private volatile long geminiUntil;
    private int temporaryFailures;

    @org.springframework.beans.factory.annotation.Autowired
    private ClienteOllama ollama;

    public List<String> modelosLocales() {
        return ollama.modelos();
    }

    public ClientePropuestasNube.Reply contenido(
        String mode,
        String model,
        String system,
        String prompt,
        int tokens,
        boolean json
    ) {
        if ("local".equalsIgnoreCase(mode)) {
            try {
                if (ollama != null && !ollama.modelos().isEmpty()) {
                    return new ClientePropuestasNube.Reply(
                        mapper.createObjectNode().put("text", ollama.contenido(model, system, prompt, tokens, json)),
                        "Ollama",
                        model,
                        0,
                        0,
                        0
                    );
                }
            } catch (Exception ex) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn(
                    "Ollama local no disponible, ejecutando fallback automatico a Cloud (Gemini/Claude): {}",
                    ex.getMessage()
                );
            }
        }
        try {
            if (System.currentTimeMillis() < geminiUntil) throw new ClientePropuestasNube.Fallo(
                "Gemini está temporalmente en espera.",
                true,
                429
            );
            var reply = client.generateRaw(false, system, prompt, tokens, json);
            synchronized (this) {
                temporaryFailures = 0;
            }
            return reply;
        } catch (ClientePropuestasNube.Fallo ex) {
            synchronized (this) {
                if (ex.status == 429) geminiUntil = System.currentTimeMillis() + 300_000;
                else if (ex.status >= 500 && ++temporaryFailures >= 2) geminiUntil =
                    System.currentTimeMillis() + 30_000;
            }
            if (Thread.currentThread().isInterrupted() || !ex.fallback || !client.fallback()) throw ex;
            return client.generateRaw(true, system, prompt, tokens, json);
        }
    }

    public ClientePropuestasNube.Reply conversar(
        String mode,
        String model,
        String system,
        String prompt,
        boolean automatic,
        ObjectNode official,
        ObjectNode options
    ) {
        if ("local".equalsIgnoreCase(mode)) {
            try {
                if (ollama != null && !ollama.modelos().isEmpty()) {
                    return ollama.conversar(model, system, prompt, automatic, official);
                }
            } catch (Exception ex) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn(
                    "Ollama local no disponible, ejecutando fallback automatico a Cloud (Gemini/Claude): {}",
                    ex.getMessage()
                );
            }
        }
        String provider = options.path("provider").asText("auto");
        boolean test =
            !provider.equals("auto") ||
            options.has("allowFallback") ||
            options.path("simulateGeminiFailure").asBoolean();
        if (test && !client.testControls()) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Los controles de prueba no están habilitados."
        );
        if (!Set.of("auto", "gemini", "claude").contains(provider)) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Proveedor inválido."
        );
        if (automatic && !provider.equals("auto")) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "La observación automática no admite otro proveedor."
        );
        if (provider.equals("claude")) return client.generateConversation(true, system, prompt, false, official);
        try {
            if (
                System.currentTimeMillis() < geminiUntil || options.path("simulateGeminiFailure").asBoolean()
            ) throw new ClientePropuestasNube.Fallo("Gemini está temporalmente en espera.", true, 429);
            var reply = client.generateConversation(false, system, prompt, automatic, official);
            synchronized (this) {
                temporaryFailures = 0;
            }
            return reply;
        } catch (ClientePropuestasNube.Fallo ex) {
            synchronized (this) {
                if (ex.status == 429 && !options.path("simulateGeminiFailure").asBoolean()) geminiUntil =
                    System.currentTimeMillis() + 300_000;
                else if (ex.status >= 500 && ++temporaryFailures >= 2) geminiUntil =
                    System.currentTimeMillis() + 30_000;
            }
            if (
                Thread.currentThread().isInterrupted() ||
                automatic ||
                !ex.fallback ||
                !provider.equals("auto") ||
                !client.fallback() ||
                !options.path("allowFallback").asBoolean(true)
            ) throw ex;
            return client.generateConversation(true, system, prompt, false, official);
        }
    }

    private static class Job {

        final String user, diagramId;
        final ObjectNode payload;
        final long created = System.currentTimeMillis();
        final CompletableFuture<ObjectNode> result = new CompletableFuture<>();
        boolean started;
        volatile boolean cancelled;
        volatile Thread runner;
        String options;

        Job(String user, String diagramId, ObjectNode payload) {
            this.user = user;
            this.diagramId = diagramId;
            this.payload = payload.deepCopy();
        }
    }

    public GatewayPropuestasNube(ClientePropuestasNube client, ServicioRevisionPropuesta reviews, ObjectMapper mapper) {
        this.client = client;
        this.reviews = reviews;
        this.mapper = mapper;
    }

    public Map<String, Object> config() {
        return Map.of(
            "available",
            client.configured(false),
            "claudeAvailable",
            client.configured(true),
            "fallbackEnabled",
            client.fallback(),
            "testControls",
            client.testControls(),
            "geminiModel",
            client.model(false),
            "claudeModel",
            client.model(true)
        );
    }

    private String key(String room, String id) {
        return room + "/" + id;
    }

    public void register(String room, String user, ObjectNode payload, boolean automatic) {
        String id = payload.path("id").asText(),
            diagramId = payload.path("diagramId").asText();
        if (
            id.isBlank() || diagramId.isBlank() || id.length() > 100 || payload.toString().length() > 150_000
        ) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "La consulta es demasiado grande o está incompleta."
        );
        reviews.autorizarInferenciaUsuario(room, diagramId, user);
        ObjectNode canonical = payload.deepCopy().put("automatic", automatic);
        jobs.entrySet().removeIf(
            e -> e.getValue().runner == null && System.currentTimeMillis() - e.getValue().created > 900_000
        );
        if (jobs.size() >= 2000) throw new ResponseStatusException(
            HttpStatus.TOO_MANY_REQUESTS,
            "Hay demasiadas solicitudes. Intenta más tarde."
        );
        Job job = new Job(user, diagramId, canonical),
            old = jobs.putIfAbsent(key(room, id), job);
        if (
            old != null && (!old.user.equals(user) || !old.payload.equals(canonical))
        ) throw new ResponseStatusException(HttpStatus.CONFLICT, "La solicitud ya existe con otro contenido.");
    }

    private Job authorized(String room, String id, String auth) {
        Job job = jobs.get(key(room, id));
        if (job == null) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "La sala no confirmó esta solicitud. Envíala nuevamente."
        );
        String user = reviews.autorizarInferencia(room, job.diagramId, auth);
        if (!job.user.equals(user)) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Solo quien envió la consulta puede ejecutarla."
        );
        return job;
    }

    public void cancel(String room, String id, String auth) {
        Job job = authorized(room, id, auth);
        job.cancelled = true;
        Thread runner = job.runner;
        if (runner != null) runner.interrupt();
    }

    public ObjectNode infer(String room, String id, String auth, ObjectNode options) {
        Job job = authorized(room, id, auth);
        String provider = options.path("provider").asText("auto");
        if (!Set.of("auto", "gemini", "claude").contains(provider)) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Proveedor de pruebas inválido."
        );
        boolean override =
            !provider.equals("auto") ||
            options.has("allowFallback") ||
            options.path("simulateGeminiFailure").asBoolean();
        if (override && !client.testControls()) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Los controles de prueba no están habilitados."
        );
        boolean automatic = job.payload.path("automatic").asBoolean();
        if (
            automatic && (provider.equals("claude") || options.path("allowFallback").asBoolean())
        ) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Las revisiones automáticas no pueden usar Claude.");
        synchronized (job) {
            if (job.started && !Objects.equals(job.options, options.toString())) throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "No cambies el proveedor de una consulta en curso."
            );
            if (!job.started) {
                job.started = true;
                job.options = options.toString();
                job.runner = Thread.currentThread();
            } else return waitResult(job);
        }
        try {
            checkCancel(job);
            ObjectNode diagram = (ObjectNode) job.payload.path("baseDiagram");
            String prompt = job.payload.path("prompt").asText();
            if (job.payload.path("draftContext").isObject()) prompt +=
                "\nCorrige únicamente esta propuesta pendiente y conserva lo aprobado: " +
                job.payload.path("draftContext");
            String system =
                "Eres @ArchAI, asesor UML colaborativo. Propón cambios sin aplicarlos. Explica brevemente en español. Devuelve siempre los cinco campos JSON: explanation (justificación breve), clarification (vacío si no hace falta), skip (false salvo revisión automática sin mejoras), classes (lista) y relations (lista, también si está vacía). Usa targetClassId para actualizar clases existentes y solo incluye miembros que cambian; no elimines miembros omitidos. Puedes enlazar clases existentes por su nombre sin repetirlas. Si necesitas aclaración, devuelve clarification. En revisión automática devuelve skip:true si no hay mejora importante. Contexto UML actual: " +
                diagram;
            boolean allow =
                !automatic &&
                client.fallback() &&
                (!options.has("allowFallback") || options.path("allowFallback").asBoolean());
            ClientePropuestasNube.Reply reply;
            if (provider.equals("claude")) reply = client.generate(true, system, prompt, automatic, diagram);
            else try {
                if (
                    System.currentTimeMillis() < geminiUntil || options.path("simulateGeminiFailure").asBoolean()
                ) throw new ClientePropuestasNube.Fallo("Gemini está temporalmente en espera.", true, 429);
                reply = client.generate(false, system, prompt, automatic, diagram);
                synchronized (this) {
                    temporaryFailures = 0;
                }
            } catch (ClientePropuestasNube.Fallo ex) {
                synchronized (this) {
                    if (ex.status == 429 && !options.path("simulateGeminiFailure").asBoolean()) geminiUntil =
                        System.currentTimeMillis() + 300_000;
                    else if (ex.status >= 500 && ++temporaryFailures >= 2) geminiUntil =
                        System.currentTimeMillis() + 30_000;
                }
                checkCancel(job);
                if (!provider.equals("auto") || !ex.fallback || !allow) throw ex;
                reply = client.generate(true, system, prompt, false, diagram);
            }
            checkCancel(job);
            ObjectNode result = mapper
                .createObjectNode()
                .put("provider", reply.provider())
                .put("model", reply.model())
                .put("durationMs", reply.durationMs());
            result.set("content", reply.content());
            result.put("inputTokens", reply.inputTokens()).put("outputTokens", reply.outputTokens());
            LoggerFactory.getLogger(getClass()).info(
                "Propuesta nube: proveedor={}, modelo={}, duraciónMs={}, entrada={}, salida={}",
                reply.provider(),
                reply.model(),
                reply.durationMs(),
                reply.inputTokens(),
                reply.outputTokens()
            );
            job.result.complete(result);
            return result.deepCopy();
        } catch (Exception ex) {
            ResponseStatusException safe =
                ex instanceof ResponseStatusException r
                    ? r
                    : new ResponseStatusException(
                          HttpStatus.BAD_GATEWAY,
                          ex instanceof ClientePropuestasNube.Fallo
                              ? ex.getMessage()
                              : "No se pudo obtener una propuesta válida del proveedor."
                      );
            job.result.completeExceptionally(safe);
            throw safe;
        } finally {
            job.runner = null;
            Thread.interrupted();
        }
    }

    private void checkCancel(Job job) {
        if (job.cancelled || Thread.currentThread().isInterrupted()) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "La consulta se canceló."
        );
    }

    private ObjectNode waitResult(Job job) {
        try {
            return job.result.get(55, TimeUnit.SECONDS).deepCopy();
        } catch (ExecutionException ex) {
            if (ex.getCause() instanceof ResponseStatusException r) throw r;
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Falló la consulta.");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La consulta se canceló.");
        } catch (TimeoutException ex) {
            throw new ResponseStatusException(
                HttpStatus.GATEWAY_TIMEOUT,
                "La consulta sigue en curso. Espera antes de reintentar."
            );
        }
    }
}
