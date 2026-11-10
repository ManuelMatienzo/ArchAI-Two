package com.archai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.archai.modulo.persistencia.entidad.OperacionDocumental;
import com.archai.modulo.persistencia.repositorio.OperacionDocumentalRepository;
import com.archai.modulo.persistencia.servicio.AlmacenDocumental;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.MongoTimeoutException;
import com.mongodb.client.*;
import java.util.List;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;

class AlmacenDocumentalTest {

    final ObjectMapper mapper = new ObjectMapper();
    OperacionDocumentalRepository outbox;
    AlmacenDocumental store;

    @BeforeEach
    void setup() {
        outbox = mock(OperacionDocumentalRepository.class);
        store = new AlmacenDocumental(outbox, mapper, new MockEnvironment());
        when(outbox.saveAndFlush(any())).thenAnswer(call -> {
            OperacionDocumental row = call.getArgument(0);
            row.setId(2L);
            return row;
        });
        when(outbox.findByColeccionOrderByIdAsc(anyString())).thenReturn(List.of());
    }

    @Test
    void mantieneHistorialDuranteCorteMongoAunqueLaColaEsteVacia() {
        store.guardar(
            "mensajes_sala",
            "sala:mensaje",
            mapper.createObjectNode().put("roomId", "sala").put("text", "Decisión compartida")
        );
        MongoDatabase db = mock(MongoDatabase.class);
        when(db.getCollection(anyString())).thenThrow(new MongoTimeoutException("fixture"));
        ReflectionTestUtils.setField(store, "database", db);
        assertEquals("Decisión compartida", store.listar("mensajes_sala", "sala").get(0).path("text").asText());
        assertEquals(0, store.listar("mensajes_sala", "otra-sala").size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void lecturaMongoAnteriorNoPisaUnaRespuestaReciente() {
        store.guardar(
            "mensajes_sala",
            "sala:mensaje",
            mapper.createObjectNode().put("roomId", "sala").put("status", "sent")
        );
        MongoDatabase db = mock(MongoDatabase.class);
        MongoCollection<Document> collection = mock(MongoCollection.class);
        FindIterable<Document> result = mock(FindIterable.class);
        MongoCursor<Document> cursor = mock(MongoCursor.class);
        when(db.getCollection(anyString())).thenReturn(collection);
        when(collection.find(any(Bson.class))).thenReturn(result);
        when(result.iterator()).thenReturn(cursor);
        when(cursor.hasNext()).thenReturn(true, false);
        when(cursor.next()).thenReturn(
            new Document("_id", "sala:mensaje")
                .append("roomId", "sala")
                .append("status", "thinking")
                .append("_persistVersion", "0000000000000000000-0000000000000000001")
        );
        ReflectionTestUtils.setField(store, "database", db);
        assertEquals("sent", store.listar("mensajes_sala", "sala").get(0).path("status").asText());
        assertEquals("sent", store.obtener("mensajes_sala", "sala:mensaje").orElseThrow().path("status").asText());
    }
}
