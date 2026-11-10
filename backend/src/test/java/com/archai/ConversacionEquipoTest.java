package com.archai;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.archai.comun.seguridad.ServicioJwt;
import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.colaboracion.servicio.*;
import com.archai.modulo.diagrama.entidad.DiagramaEntity;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.ia.servicio.*;
import com.archai.modulo.persistencia.servicio.AlmacenDocumental;
import com.archai.modulo.proyecto.entidad.*;
import com.archai.modulo.proyecto.repositorio.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@ActiveProfiles("local-test")
class ConversacionEquipoTest {

    @Autowired
    ServicioConversacion chat;

    @Autowired
    ServicioRevisionPropuesta reviews;

    @Autowired
    ServicioSalaColaborativa rooms;

    @Autowired
    UsuarioRepository users;

    @Autowired
    ProyectoRepository projects;

    @Autowired
    MiembroProyectoRepository members;

    @Autowired
    DiagramaRepository diagrams;

    @Autowired
    ServicioJwt jwt;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    AlmacenDocumental docs;

    @MockBean
    GatewayPropuestasNube gateway;

    String room, id, owner, reader, auth, readAuth;
    ObjectNode official;

    @BeforeEach
    void setup() throws Exception {
        reset(gateway);
        when(gateway.config()).thenReturn(
            Map.of("available", true, "claudeAvailable", true, "fallbackEnabled", true, "testControls", false)
        );
        owner = "u-" + UUID.randomUUID();
        reader = "u-" + UUID.randomUUID();
        room = "ARC-" + UUID.randomUUID().toString().toUpperCase();
        id = "d-" + UUID.randomUUID();
        var u = users.save(
            UsuarioEntity.builder()
                .id(owner)
                .nombre("Ana")
                .nombreUsuario(owner)
                .correo(owner + "@test.invalid")
                .contrasena("hash")
                .build()
        );
        var r = users.save(
            UsuarioEntity.builder()
                .id(reader)
                .nombre("Luis")
                .nombreUsuario(reader)
                .correo(reader + "@test.invalid")
                .contrasena("hash")
                .build()
        );
        var p = projects.save(
            ProyectoEntity.builder()
                .id("p-" + UUID.randomUUID())
                .nombre("Clínica de prueba")
                .propietario(u)
                .build()
        );
        members.save(
            MiembroProyectoEntity.builder()
                .id(UUID.randomUUID().toString())
                .proyecto(p)
                .usuario(r)
                .rolProyecto("LECTOR")
                .build()
        );
        official = (ObjectNode) mapper.readTree(
            "{\"title\":\"Clínica\",\"classes\":[{\"id\":\"paciente\",\"name\":\"Paciente\",\"attributes\":[],\"methods\":[]}],\"relations\":[]}"
        );
        diagrams.save(
            DiagramaEntity.builder()
                .id(id)
                .titulo("Clínica")
                .proyecto(p)
                .creador(u)
                .jsonDiagrama(official.toString())
                .build()
        );
        rooms.crearSala("Clínica", PerfilUsuarioDto.builder().id(owner).name("Ana").build(), room);
        auth = "Bearer " + jwt.generarToken(owner, "Ana", "Editor");
        readAuth = "Bearer " + jwt.generarToken(reader, "Luis", "Lector");
        reviews.estado(room, id, auth);
    }

    ObjectNode body(String text) {
        return mapper.createObjectNode().put("id", UUID.randomUUID().toString()).put("text", text);
    }

    void stub(ObjectNode content) {
        when(
            gateway.conversar(anyString(), anyString(), anyString(), anyString(), anyBoolean(), any(), any())
        ).thenReturn(new ClientePropuestasNube.Reply(content, "Gemini", "fixture", 1, 10, 20));
    }

    ObjectNode answer(String text) {
        ObjectNode n = mapper.createObjectNode().put("explanation", text).put("clarification", "").put("skip", false);
        n.putArray("classes");
        n.putArray("relations");
        n.putArray("deletions");
        return n;
    }

    ObjectNode waitReply(String request) throws Exception {
        for (int i = 0; i < 150; i++) {
            var reply = chat
                .historial(room, id, auth, 0, 100)
                .stream()
                .filter(
                    m ->
                        m.path("replyTo").asText().equals(request) &&
                        Set.of("sent", "failed").contains(m.path("status").asText())
                )
                .findFirst();
            if (reply.isPresent()) return reply.get();
            Thread.sleep(20);
        }
        throw new AssertionError("La cola no completó la respuesta");
    }

    @Test
    void humanosNoConsumenIaYReintentarNoDuplica() {
        var request = body("Acordamos usar UUID para los identificadores");
        chat.enviar(room, id, auth, request);
        chat.enviar(room, id, auth, request);
        assertEquals(1, chat.historial(room, id, auth, 0, 100).size());
        verify(gateway, never()).conversar(
            anyString(),
            anyString(),
            anyString(),
            anyString(),
            anyBoolean(),
            any(),
            any()
        );
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> chat.enviar(room, id, readAuth, request))
                .getStatusCode()
                .value()
        );
    }

    @Test
    void lectorPuedePreguntarConIdentidadYMemoriaUnificada() throws Exception {
        chat.enviar(room, id, auth, body("Acordamos que Receta pertenece a un solo Paciente."));
        stub(answer("Mantendremos una asociación 1:N."));
        var request = body("@aRcHaI ¿Qué decidió Ana?");
        chat.enviar(room, id, readAuth, request);
        chat.enviar(room, id, readAuth, request);
        assertEquals("sent", waitReply(request.path("id").asText()).path("status").asText());
        ArgumentCaptor<String> system = ArgumentCaptor.forClass(String.class);
        verify(gateway, times(1)).conversar(
            eq("cloud"),
            anyString(),
            system.capture(),
            anyString(),
            eq(false),
            any(),
            any()
        );
        assertTrue(system.getValue().contains("Acordamos que Receta"));
        assertTrue(system.getValue().contains("Ana"));
        assertTrue(system.getValue().contains("Paciente"));
    }

    @Test
    void propuestaServidorNoModificaOficialYSeRecupera() throws Exception {
        ObjectNode content = answer("Propongo Receta");
        content.withArray("classes").addObject().put("name", "Receta").putArray("attributes");
        ((ObjectNode) content.path("classes").get(0)).putArray("methods");
        stub(content);
        var request = body("@ArchAI propón Receta");
        chat.enviar(room, id, auth, request);
        var reply = waitReply(request.path("id").asText());
        assertTrue(reply.hasNonNull("proposalId"));
        var state = reviews.estado(room, id, auth);
        assertEquals(1, state.path("official").path("classes").size());
        assertEquals(1, state.path("proposals").size());
        assertTrue(docs.obtener("revision_propuestas", room).isPresent());
        assertTrue(docs.obtener("mensajes_sala", room + ":" + reply.path("id").asText()).isPresent());
    }

    @Test
    void soloAnfitrionConfiguraYObservacionIniciaApagada() {
        assertFalse(chat.configuracion(room, id, auth).path("observing").asBoolean());
        assertEquals(
            403,
            assertThrows(ResponseStatusException.class, () ->
                chat.configurar(room, id, readAuth, mapper.createObjectNode().put("mode", "local"))
            )
                .getStatusCode()
                .value()
        );
        assertEquals(
            "local",
            chat.configurar(room, id, auth, mapper.createObjectNode().put("mode", "local")).path("mode").asText()
        );
    }

    @Test
    void otraCuentaNoLeeConversacion() {
        String stranger = "Bearer " + jwt.generarToken("desconocido", "Extraño", "Editor");
        assertEquals(
            403,
            assertThrows(ResponseStatusException.class, () -> chat.historial(room, id, stranger, 0, 100))
                .getStatusCode()
                .value()
        );
    }

    @Test
    void restaurarCheckpointConservaChatYRechazaRevisionAntigua() {
        var request = body("Acordamos conservar la trazabilidad del equipo.");
        chat.enviar(room, id, auth, request);
        reviews.guardarSesion(room, id, auth);
        String checkpoint = reviews.puntosControl(room, id, auth).get(0).path("id").asText();
        ObjectNode changed = (ObjectNode) reviews.estado(room, id, auth).path("official");
        changed.withArray("classes").addObject().put("id", "receta").put("name", "Receta").putArray("attributes");
        reviews.actualizarOficialConToken(room, changed, auth);
        long revision = reviews.estado(room, id, auth).path("officialRevision").asLong();
        var command = mapper
            .createObjectNode()
            .put("action", "restore")
            .put("checkpointId", checkpoint)
            .put("expectedRevision", revision)
            .put("operationId", UUID.randomUUID().toString());
        assertEquals(
            403,
            assertThrows(ResponseStatusException.class, () -> reviews.restaurar(room, id, readAuth, command))
                .getStatusCode()
                .value()
        );
        var restored = reviews.restaurar(room, id, auth, command);
        assertEquals(1, restored.path("official").path("classes").size());
        assertEquals(
            1,
            chat
                .historial(room, id, auth, 0, 100)
                .stream()
                .filter(m -> m.path("id").asText().equals(request.path("id").asText()))
                .count()
        );
        command.put("operationId", UUID.randomUUID().toString());
        assertEquals(
            409,
            assertThrows(ResponseStatusException.class, () -> reviews.restaurar(room, id, auth, command))
                .getStatusCode()
                .value()
        );
    }

    @Test
    void eventoDeGuardadoAntiguoNoReemplazaModeloMasReciente() throws Exception {
        ObjectNode latest = official.deepCopy();
        latest.withArray("classes").addObject().put("id", "receta").put("name", "Receta").putArray("attributes");
        latest.put("_reviewRevision", 2);
        var entity = diagrams.findById(id).orElseThrow();
        entity.setJsonDiagrama(latest.toString());
        diagrams.saveAndFlush(entity);
        reviews.guardadoExterno(new com.archai.modulo.diagrama.servicio.DiagramaPersistido(id, official.toString()));
        assertEquals(2, reviews.estado(room, id, auth).path("official").path("classes").size());
    }

    @Test
    void colaRespetaCancelacionSinEjecutarLaSiguienteConsulta() throws Exception {
        var entered = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        when(
            gateway.conversar(anyString(), anyString(), anyString(), anyString(), anyBoolean(), any(), any())
        ).thenAnswer(invocation -> {
            entered.countDown();
            release.await(3, java.util.concurrent.TimeUnit.SECONDS);
            return new ClientePropuestasNube.Reply(answer("Respuesta"), "Gemini", "fixture", 1, 10, 20);
        });
        var first = body("@ArchAI explica la primera decisión");
        var second = body("@ArchAI explica la segunda decisión");
        try {
            chat.enviar(room, id, auth, first);
            assertTrue(entered.await(2, java.util.concurrent.TimeUnit.SECONDS));
            chat.enviar(room, id, auth, second);
            chat.cancelar(room, id, auth, "ai-" + second.path("id").asText());
            release.countDown();
            waitReply(first.path("id").asText());
            Thread.sleep(80);
            assertEquals(
                "cancelled",
                chat
                    .historial(room, id, auth, 0, 100)
                    .stream()
                    .filter(m ->
                        m
                            .path("id")
                            .asText()
                            .equals("ai-" + second.path("id").asText())
                    )
                    .findFirst()
                    .orElseThrow()
                    .path("status")
                    .asText()
            );
            verify(gateway, times(1)).conversar(
                anyString(),
                anyString(),
                anyString(),
                anyString(),
                anyBoolean(),
                any(),
                any()
            );
        } finally {
            release.countDown();
        }
    }

    @Test
    void eliminacionSoloConSeleccionExplicitaYSePuedeDeshacer() {
        ObjectNode response = answer("Eliminar Paciente solo después de confirmar.");
        response.withArray("deletions").addObject().put("kind", "class").put("targetId", "paciente").put("classId", "");
        ObjectNode draft = ContratoConversacion.normalizar(response, official),
            proposal = mapper
                .createObjectNode()
                .put("id", "delete-proposal")
                .put("status", "ready")
                .put("explanation", "Eliminar Paciente");
        proposal.set("diagram", draft);
        reviews.registrarIA(room, id, owner, proposal, official);
        var preview = mapper
            .createObjectNode()
            .put("action", "preview")
            .put("proposalId", "delete-proposal")
            .put("expectedRevision", 0)
            .put("operationId", UUID.randomUUID().toString());
        reviews.comando(room, id, auth, preview);
        var approve = mapper
            .createObjectNode()
            .put("action", "approve")
            .put("proposalId", "delete-proposal")
            .put("expectedRevision", 1)
            .put("operationId", UUID.randomUUID().toString());
        approve.putArray("classIds");
        approve.putArray("relationIds");
        approve.putArray("deletionIds").add(draft.path("deletions").get(0).path("id").asText());
        var result = reviews.comando(room, id, auth, approve);
        assertEquals(0, result.path("official").path("classes").size());
        var undo = mapper
            .createObjectNode()
            .put("action", "undo")
            .put("expectedRevision", result.path("officialRevision").asLong())
            .put("operationId", UUID.randomUUID().toString());
        assertEquals(1, reviews.restaurar(room, id, auth, undo).path("official").path("classes").size());
    }
}
