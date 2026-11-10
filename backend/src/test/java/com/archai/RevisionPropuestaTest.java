package com.archai;

import com.archai.modulo.colaboracion.servicio.*;
import com.archai.comun.seguridad.ServicioJwt;
import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.proyecto.entidad.*;
import com.archai.modulo.proyecto.repositorio.*;
import com.archai.modulo.diagrama.entidad.DiagramaEntity;
import com.archai.modulo.diagrama.repositorio.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("local-test")
class RevisionPropuestaTest {
    @Autowired ServicioRevisionPropuesta service;
    @Autowired com.archai.modulo.diagrama.servicio.ServicioDiagrama diagramService;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired ServicioJwt jwt;
    @Autowired ObjectMapper mapper;
    @Autowired UsuarioRepository users;
    @Autowired ProyectoRepository projects;
    @Autowired MiembroProyectoRepository members;
    @Autowired DiagramaRepository diagrams;
    @Autowired VersionDiagramaRepository versions;
    String room,id,auth,readerAuth,userId;
    ObjectNode official,draft;
    @BeforeEach void setup() throws Exception {
        userId="u-"+UUID.randomUUID(); id="d-"+UUID.randomUUID(); room="ARC-"+UUID.randomUUID();
        var owner=users.save(UsuarioEntity.builder().id(userId).nombre("Editor prueba").nombreUsuario(userId).correo(userId+"@test.invalid").contrasena("test-hash").build());
        var reader=users.save(UsuarioEntity.builder().id("r-"+UUID.randomUUID()).nombre("Lector prueba").nombreUsuario("lector-"+UUID.randomUUID()).correo(UUID.randomUUID()+"@test.invalid").contrasena("test-hash").build());
        var project=projects.save(ProyectoEntity.builder().id("p-"+UUID.randomUUID()).nombre("Prueba aislada").propietario(owner).build());
        members.save(MiembroProyectoEntity.builder().id(UUID.randomUUID().toString()).proyecto(project).usuario(reader).rolProyecto("LECTOR").build());
        official=(ObjectNode)mapper.readTree("""
          {"title":"Prueba","classes":[{"id":"paciente","name":"Paciente","position":{"x":100,"y":100},"attributes":[{"id":"a","name":"nombre","type":"String","visibility":"+","isReadOnly":true}],"methods":[]}],"relations":[]}
          """);
        diagrams.save(DiagramaEntity.builder().id(id).titulo("Prueba").proyecto(project).creador(owner).jsonDiagrama(official.toString()).build());
        auth="Bearer "+jwt.generarToken(userId,"Editor prueba","Desarrollador");readerAuth="Bearer "+jwt.generarToken(reader.getId(),"Lector prueba","Observador");
        draft=(ObjectNode)mapper.readTree("""
          {"classes":[{"id":"receta","name":"Receta","attributes":[{"id":"med","name":"medicamento","type":"String","visibility":"+"}],"methods":[]},{"id":"dosis","name":"Dosis","attributes":[],"methods":[]}],"relations":[{"id":"rel","sourceClassId":"paciente","targetClassId":"receta","type":"ASSOCIATION_1_N","sourceMultiplicity":"1","targetMultiplicity":"0..*"}]}
          """);
    }
    ObjectNode command(String action,long revision) {return mapper.createObjectNode().put("action",action).put("operationId",UUID.randomUUID().toString()).put("proposalId","proposal").put("expectedRevision",revision);}
    ObjectNode send(ObjectNode c) {return service.comando(room,id,auth,c);}
    void register() {
        var c=command("register",0);ObjectNode p=mapper.createObjectNode().put("id","proposal").put("status","ready").put("explanation","Separar recetas y dosis.");p.set("diagram",draft);c.set("proposal",p);c.set("baseDiagram",official);send(c);send(command("preview",0));
    }
    @Test void aprobarParcialConservaPendientesYRechazarNoRevierteLoAprobado() throws Exception {
        register();var c=command("approve",1);c.putArray("classIds").add("receta");c.putArray("relationIds").add("rel");
        var result=send(c);var p=result.path("proposals").get(0);
        assertEquals("partial",p.path("moderationStatus").asText());assertEquals("Dosis",p.path("diagram").path("classes").get(0).path("name").asText());
        assertEquals(2,result.path("official").path("classes").size());assertEquals(1,result.path("official").path("relations").size());
        assertTrue(result.path("official").path("classes").get(0).path("attributes").get(0).path("isReadOnly").asBoolean());
        var stored=mapper.readTree(diagrams.findById(id).orElseThrow().getJsonDiagrama());assertEquals(2,stored.path("classes").size());assertEquals(1,versions.findByDiagramaIdOrderByNumeroVersionDesc(id).size());
        assertEquals(2,diagramService.obtenerPorId(id).orElseThrow().getClasses().size(),"El Hub recupera el diagrama aprobado con fechas");
        send(c);assertEquals(1,versions.findByDiagramaIdOrderByNumeroVersionDesc(id).size(),"Reintentar no duplica la versión");
        var stale=mapper.convertValue(official,com.archai.modulo.diagrama.dto.DiagramDto.class);stale.setId(id);
        assertEquals(409,assertThrows(ResponseStatusException.class,()->diagramService.guardarDiagrama(stale)).getStatusCode().value(),"Un guardado antiguo no pisa una aprobación");
        var rejected=send(command("reject",2));assertEquals(2,rejected.path("official").path("classes").size());assertEquals("rejected",rejected.path("proposals").get(0).path("moderationStatus").asText());
    }
    @Test void dosAprobacionesSimultaneasSoloConsolidanUnaVez() throws Exception {
        register();var a=command("approve",1);a.putArray("classIds").add("receta").add("dosis");a.putArray("relationIds").add("rel");var b=a.deepCopy().put("operationId",UUID.randomUUID().toString());
        var pool=Executors.newFixedThreadPool(2);try {
            var jobs=pool.invokeAll(List.<Callable<Boolean>>of(()->{try{send(a);return true;}catch(ResponseStatusException ex){assertEquals(409,ex.getStatusCode().value());return false;}},()->{try{send(b);return true;}catch(ResponseStatusException ex){assertEquals(409,ex.getStatusCode().value());return false;}}));
            assertEquals(1,jobs.stream().filter(f->{try{return f.get();}catch(Exception ex){throw new RuntimeException(ex);}}).count());
        }finally{pool.shutdownNow();}
        assertEquals(1,versions.findByDiagramaIdOrderByNumeroVersionDesc(id).size());
    }
    @Test void guardarYCargarConFechasConservaClasesYMetadatos() throws Exception {
        var dto=mapper.treeToValue(official,com.archai.modulo.diagrama.dto.DiagramDto.class);
        dto.setId(id);dto.setCreadorId(userId);dto.setUpdatedAt(java.time.LocalDateTime.now());
        diagramService.guardarDiagrama(dto);
        var raw=mapper.readTree(diagrams.findById(id).orElseThrow().getJsonDiagrama());
        assertEquals(1,raw.path("classes").size(),"Nunca sustituir el diseño por un objeto vacío al serializar fechas");
        var loaded=diagramService.obtenerPorId(id).orElseThrow();
        assertEquals(1,loaded.getClasses().size());assertEquals("Paciente",loaded.getClasses().get(0).getName());
        assertNotNull(loaded.getUpdatedAt());
        assertTrue(diagramService.listarDiagramas(null).stream().anyMatch(d->id.equals(d.getId()) && d.getClasses().size()==1));
    }
    @Test void inferenciaRequiereEditorAutenticadoYDiagramaDeLaSala() {
        assertEquals(userId,service.autorizarInferencia(room,id,auth));
        assertEquals(403,assertThrows(ResponseStatusException.class,()->service.autorizarInferencia(room,id,readerAuth)).getStatusCode().value());
        assertEquals(401,assertThrows(ResponseStatusException.class,()->service.autorizarInferencia(room,id,"Bearer invalid")).getStatusCode().value());
        assertThrows(ResponseStatusException.class,()->service.autorizarInferenciaUsuario(room,id,null));
    }
    @Test void lectorNoModeraYSalasNoCompartenBorradores() {
        register();assertFalse(service.estado(room,id,readerAuth).path("canModerate").asBoolean());
        var ex=assertThrows(ResponseStatusException.class,()->service.comando(room,id,readerAuth,command("reject",1)));assertEquals(403,ex.getStatusCode().value());
        assertTrue(service.estado("ARC-OTRA-"+UUID.randomUUID(),id,auth).path("proposals").isEmpty());
        assertEquals(1,service.estado(room,id,auth).path("proposals").size(),"Reconectar recupera el borrador");
        assertThrows(ResponseStatusException.class,()->service.estado(room,id,"Bearer invalid"));
    }
    @Test void cambiosConcurrentesYDependenciasSeRevalidan() {
        register();var missing=command("approve",1);missing.putArray("relationIds").add("rel");assertThrows(ResponseStatusException.class,()->send(missing));assertTrue(versions.findByDiagramaIdOrderByNumeroVersionDesc(id).isEmpty());
        var live=(ObjectNode)service.estado(room,id,auth).path("official").deepCopy();live.put("title","Título cambiado");service.actualizarOficial(room,live,userId);
        var approve=command("approve",1);approve.putArray("classIds").add("receta");approve.putArray("relationIds").add("rel");assertEquals(409,assertThrows(ResponseStatusException.class,()->send(approve)).getStatusCode().value());
        send(command("rebase",1));approve.put("expectedRevision",2);assertEquals(2,send(approve).path("official").path("classes").size());
        assertThrows(ResponseStatusException.class,()->service.actualizarOficialConToken(room,official,readerAuth));
        assertEquals("Título cambiado",((JsonNode)service.actualizarOficial(room,official,userId)).path("title").asText(),"Snapshot antiguo no pisa aprobación");
    }
    @Test void actualizacionPreservaMiembrosYRenombradoNoDuplicaClase() throws Exception {
        var update=(ObjectNode)mapper.readTree("""
          {"classes":[{"id":"cambio","targetClassId":"paciente","name":"PacienteActualizado","attributes":[{"id":"nuevo","name":"edad","type":"Integer","visibility":"-"}],"methods":[]}],"relations":[]}
          """);
        var result=MotorBorrador.fusionar(official,update,Set.of("cambio"),Set.of(),Map.of()).official();
        assertEquals("paciente",result.path("classes").get(0).path("id").asText());assertEquals(2,result.path("classes").get(0).path("attributes").size());
        assertEquals("a",result.path("classes").get(0).path("attributes").get(0).path("id").asText());assertEquals("Paciente",official.path("classes").get(0).path("name").asText());
    }
    @Test void falloDePersistenciaNoApruebaNiDejaVersionParcial() {
        register();String constraint="failure_"+UUID.randomUUID().toString().replace("-","");
        jdbc.execute("ALTER TABLE diagramas ADD CONSTRAINT "+constraint+" CHECK (id <> '"+id+"' OR json_diagrama NOT LIKE '%Receta%')");
        try {
            var c=command("approve",1);c.putArray("classIds").add("receta");c.putArray("relationIds").add("rel");
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->send(c));
            var result=service.estado(room,id,auth);
            assertEquals("pending",result.path("proposals").get(0).path("moderationStatus").asText());
            assertEquals(1,result.path("official").path("classes").size());assertTrue(versions.findByDiagramaIdOrderByNumeroVersionDesc(id).isEmpty());
        }finally{jdbc.execute("ALTER TABLE diagramas DROP CONSTRAINT "+constraint);}
    }

    @Test void aprobacionEnOtraSalaNoSobrescribeGuardadoConcurrente() {
        register();String secondRoom=room+"-B";
        service.estado(secondRoom,id,auth);
        var reg=command("register",0);reg.set("proposal",mapper.createObjectNode().put("id","proposal").put("status","ready").set("diagram",draft));reg.set("baseDiagram",official);
        service.comando(secondRoom,id,auth,reg);service.comando(secondRoom,id,auth,command("preview",0));
        var a=command("approve",1);a.putArray("classIds").add("receta");a.putArray("relationIds").add("rel");send(a);
        var b=command("approve",1);b.putArray("classIds").add("dosis");b.putArray("relationIds");
        assertEquals(409,assertThrows(ResponseStatusException.class,()->service.comando(secondRoom,id,auth,b)).getStatusCode().value());
        assertEquals(1,versions.findByDiagramaIdOrderByNumeroVersionDesc(id).size());
    }

}
