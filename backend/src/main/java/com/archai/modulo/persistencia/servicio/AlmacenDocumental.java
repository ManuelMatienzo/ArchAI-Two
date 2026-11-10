package com.archai.modulo.persistencia.servicio;

import com.archai.modulo.persistencia.entidad.OperacionDocumental;
import com.archai.modulo.persistencia.repositorio.OperacionDocumentalRepository;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mongodb.*;
import com.mongodb.client.*;
import com.mongodb.client.model.*;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.bson.Document;
import org.springframework.core.env.Environment;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.*;

/** MongoDB documents with an SQL outbox committed together with official approvals. */
@Service
@EnableScheduling
public class AlmacenDocumental {

    private final OperacionDocumentalRepository outbox;
    private final ObjectMapper mapper;
    private final MongoClient client;
    private final MongoDatabase database;
    private final Map<String, ObjectNode> cache = new ConcurrentHashMap<>();
    private final Map<String, String> cacheVersions = new HashMap<>();
    private volatile boolean connected;
    private volatile long lastAttempt;
    private final Set<String> indexed = ConcurrentHashMap.newKeySet();

    public AlmacenDocumental(OperacionDocumentalRepository outbox, ObjectMapper mapper, Environment env) {
        this.outbox = outbox;
        this.mapper = mapper;
        boolean test = env.acceptsProfiles(org.springframework.core.env.Profiles.of("local-test"));
        String uri = env.getProperty(test ? "ARCHAI_TEST_MONGODB_URI" : "SPRING_DATA_MONGODB_URI", "").strip();
        if (uri.isBlank()) {
            client = null;
            database = null;
            return;
        }
        try {
            ConnectionString cs = new ConnectionString(uri);
            client = MongoClients.create(
                MongoClientSettings.builder()
                    .applyConnectionString(cs)
                    .applyToClusterSettings(b -> b.serverSelectionTimeout(3, TimeUnit.SECONDS))
                    .applyToSocketSettings(b -> b.connectTimeout(3, TimeUnit.SECONDS).readTimeout(5, TimeUnit.SECONDS))
                    .build()
            );
            database = client.getDatabase(cs.getDatabase() == null ? "archai_sessions" : cs.getDatabase());
        } catch (RuntimeException ex) {
            throw new IllegalStateException("Revisa SPRING_DATA_MONGODB_URI: la conexión de MongoDB no es válida.");
        }
    }

    private String key(String collection, String id) {
        return collection + "/" + id;
    }

    private ObjectNode parse(String value) {
        try {
            return (ObjectNode) mapper.readTree(value);
        } catch (Exception ex) {
            throw new IllegalStateException("No se pudo recuperar un documento de sesión.");
        }
    }

    private ObjectNode fromBson(Document doc) {
        doc.remove("_id");
        doc.remove("_persistVersion");
        return parse(doc.toJson());
    }

    private String version(OperacionDocumental row) {
        return String.format("%019d-%019d", row.getCreadaEn().toEpochMilli(), row.getId());
    }

    private ObjectNode remember(String collection, String id, ObjectNode value, String version) {
        synchronized (cache) {
            String key = key(collection, id);
            if (version.compareTo(cacheVersions.getOrDefault(key, "")) >= 0) {
                cache.put(key, value.deepCopy());
                cacheVersions.put(key, version);
            }
            return cache.get(key).deepCopy();
        }
    }

    public Map<String, Object> estado() {
        return Map.of("configured", database != null, "connected", connected, "pending", outbox.count());
    }

    @Transactional
    public long guardar(String collection, String id, ObjectNode body) {
        ObjectNode safe = body.deepCopy();
        OperacionDocumental row = outbox.saveAndFlush(new OperacionDocumental(collection, id, safe.toString()));
        Runnable update = () -> remember(collection, id, safe, version(row));
        if (
            TransactionSynchronizationManager.isSynchronizationActive()
        ) TransactionSynchronizationManager.registerSynchronization(
            new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    update.run();
                }
            }
        );
        else update.run();
        return row.getId();
    }

    public Optional<ObjectNode> obtener(String collection, String id) {
        ObjectNode cached = cache.get(key(collection, id));
        if (cached != null) return Optional.of(cached.deepCopy());
        ObjectNode found = null;
        if (database != null) try {
            Document doc = database.getCollection(collection).find(Filters.eq("_id", id)).first();
            if (doc != null) found = remember(
                collection,
                id,
                fromBson(new Document(doc)),
                String.valueOf(doc.getOrDefault("_persistVersion", ""))
            );
            connected = true;
        } catch (MongoException ex) {
            connected = false;
        }
        for (var row : outbox.findByColeccionAndDocumentoIdOrderByIdAsc(collection, id))
            found = remember(collection, id, parse(row.getContenido()), version(row));
        return Optional.ofNullable(found);
    }

    public List<ObjectNode> listar(String collection, String room) {
        Map<String, ObjectNode> records = new LinkedHashMap<>();
        boolean unavailable = database == null;
        if (database != null) try {
            var query = room == null ? new Document() : Filters.eq("roomId", room);
            for (Document d : database.getCollection(collection).find(query)) {
                String id = d.getString("_id");
                records.put(
                    id,
                    remember(
                        collection,
                        id,
                        fromBson(new Document(d)),
                        String.valueOf(d.getOrDefault("_persistVersion", ""))
                    )
                );
            }
            connected = true;
        } catch (MongoException ex) {
            connected = false;
            unavailable = true;
        }
        if (unavailable) for (var entry : cache.entrySet())
            if (
                entry.getKey().startsWith(collection + "/") &&
                (room == null || room.equals(entry.getValue().path("roomId").asText()))
            ) records.put(entry.getKey().substring(collection.length() + 1), entry.getValue().deepCopy());
        for (var row : outbox.findByColeccionOrderByIdAsc(collection)) {
            ObjectNode value = parse(row.getContenido());
            if (room == null || room.equals(value.path("roomId").asText())) records.put(
                row.getDocumentoId(),
                remember(collection, row.getDocumentoId(), value, version(row))
            );
        }
        return new ArrayList<>(records.values());
    }

    @Scheduled(fixedDelay = 2000)
    public synchronized void sincronizar() {
        if (database == null || (!connected && System.currentTimeMillis() - lastAttempt < 15_000)) return;
        lastAttempt = System.currentTimeMillis();
        try {
            database.runCommand(new Document("ping", 1));
            connected = true;
            for (var row : outbox.findTop100ByOrderByIdAsc()) {
                var collection = database.getCollection(row.getColeccion());
                if (!indexed.contains(row.getColeccion())) {
                    collection.createIndex(Indexes.ascending("roomId", "sequence"));
                    indexed.add(row.getColeccion());
                }
                Document old = collection
                    .find(Filters.eq("_id", row.getDocumentoId()))
                    .projection(Projections.include("_persistVersion"))
                    .first();
                String version = version(row);
                if (old == null || String.valueOf(old.getOrDefault("_persistVersion", "")).compareTo(version) < 0) {
                    Document value = Document.parse(row.getContenido());
                    value.put("_id", row.getDocumentoId());
                    value.put("_persistVersion", version);
                    collection.replaceOne(
                        Filters.eq("_id", row.getDocumentoId()),
                        value,
                        new ReplaceOptions().upsert(true)
                    );
                }
                outbox.deleteById(row.getId());
            }
        } catch (MongoException ex) {
            connected = false;
        } // Keep the durable outbox; do not log connection strings.
    }

    @PreDestroy
    public void cerrar() {
        if (client != null) client.close();
    }
}
