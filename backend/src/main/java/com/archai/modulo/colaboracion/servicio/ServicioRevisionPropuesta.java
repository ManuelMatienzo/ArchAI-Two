package com.archai.modulo.colaboracion.servicio;

import com.archai.comun.seguridad.ServicioJwt;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.proyecto.repositorio.MiembroProyectoRepository;
import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.util.*;
import static com.archai.modulo.colaboracion.servicio.MotorBorrador.*;

/** Autoridad de moderación para la instancia activa. Persistencia durable de borradores: CU-21. */
@Service
@RequiredArgsConstructor
public class ServicioRevisionPropuesta {
    private final ServicioJwt jwt;
    private final DiagramaRepository diagramas;
    private final MiembroProyectoRepository miembros;
    private final ServicioSalaColaborativa salas;
    private final PersistenciaPropuesta persistencia;
    private final SimpMessagingTemplate broker;
    private final ObjectMapper mapper;
    private final Map<String,Estado> estados=new HashMap<>();
    private static class Estado {
        String diagramId, active="", persistedStructure=""; long revision=0, sequence=0;
        ObjectNode official;
        final Map<String,ObjectNode> proposals=new LinkedHashMap<>();
        final Map<String,ObjectNode> results=new LinkedHashMap<>();
    }
    private record Acceso(String id, boolean edit) {}
    private Acceso acceso(String diagramId,String authorization) {
        String token=authorization!=null && authorization.startsWith("Bearer ")?authorization.substring(7):"";
        var claims=jwt.validarToken(token).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Inicia sesión para revisar propuestas."));
        return permisos(diagramId,String.valueOf(claims.get("sub")));
    }
    private Acceso permisos(String diagramId,String user) {
        var d=diagramas.findForReview(diagramId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Guarda primero el diagrama del proyecto."));
        if(d.getProyecto()==null) {
            if(d.getCreador()!=null && user.equals(d.getCreador().getId())) return new Acceso(user,true);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No tienes acceso a este diagrama.");
        }
        var p=d.getProyecto();
        if(p.getPropietario()!=null && user.equals(p.getPropietario().getId())) return new Acceso(user,true);
        var member=miembros.findByProyectoIdAndUsuarioId(p.getId(),user).orElseThrow(()->new ResponseStatusException(HttpStatus.FORBIDDEN,"No eres miembro de este proyecto."));
        return new Acceso(user,Set.of("PROPIETARIO","ADMINISTRADOR","EDITOR").contains(member.getRolProyecto()));
    }
    public synchronized String autorizarInferencia(String room,String id,String auth) {
        Acceso a=acceso(id,auth);
        autorizarInferenciaUsuario(room,id,a.id); return a.id;
    }
    public synchronized void autorizarInferenciaUsuario(String room,String id,String user) {
        if(user==null || !permisos(id,user).edit) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No tienes permiso para solicitar propuestas.");
        sala(room,id);
    }
    private Estado sala(String room,String diagramId) {
        Estado e=estados.get(room);
        if(e!=null) {
            if(!e.diagramId.equals(diagramId)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Esta sala tiene otro diagrama activo. Entra en la sala del proyecto.");
            return e;
        }
        e=new Estado(); e.diagramId=diagramId;
        try {
            e.persistedStructure=estructura(mapper.readTree(diagramas.findById(diagramId).orElseThrow().getJsonDiagrama()));
            Object live=salas.obtenerDiagramaDeSala(room);
            e.official=live==null?objeto(mapper.readTree(diagramas.findById(diagramId).orElseThrow().getJsonDiagrama())):objeto(mapper.valueToTree(live));
            e.official=e.official.deepCopy(); e.revision=e.official.path("_reviewRevision").asLong(0);
        } catch(Exception ex) { throw error("No se pudo recuperar el diagrama oficial."); }
        e.official.put("id",diagramId); e.official.put("_reviewRevision",e.revision); estados.put(room,e); return e;
    }
    private ObjectNode snapshot(Estado e) {
        ObjectNode n=mapper.createObjectNode(); n.put("sequence",e.sequence); n.put("diagramId",e.diagramId); n.put("activeId",e.active); n.put("officialRevision",e.revision);
        ArrayNode items=n.putArray("proposals"); e.proposals.values().forEach(p->items.add(p.deepCopy()));
        n.set("official",e.official.deepCopy()); return n;
    }
    public synchronized ObjectNode estado(String room,String id,String auth) {
        Acceso a=acceso(id,auth); ObjectNode n=snapshot(sala(room,id)); n.put("canModerate",a.edit); return n;
    }
    private void emitir(String room,String type,Object payload) {
        broker.convertAndSend("/topic/collab/"+room,MensajeColaboracionDto.builder().tipo(type).salaId(room).emisorId("sistema-revision").emisorNombre("ArchAI").timestamp(System.currentTimeMillis()).payload(payload).build());
    }
    private Set<String> seleccion(JsonNode body,String key) {
        Set<String> result=new HashSet<>(); body.path(key).forEach(x->result.add(x.asText())); return result;
    }
    public synchronized ObjectNode comando(String room,String id,String auth,ObjectNode body) {
        Acceso a=acceso(id,auth); Estado e=sala(room,id); String action=texto(body,"action"), op=texto(body,"operationId"), proposalId=texto(body,"proposalId");
        if(proposalId.isBlank() || proposalId.length()>100 || op.isBlank() || op.length()>100) throw error("Falta el identificador de operación.");
        String cacheKey=a.id+":"+op;
        if(e.results.containsKey(cacheKey)) return snapshot(e).put("canModerate",a.edit);
        if(!a.edit) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Solo los miembros con edición pueden modificar propuestas.");
        ObjectNode p=e.proposals.get(proposalId);
        if(action.equals("register")) {
            if(p==null) {
                p=objeto(body.path("proposal")).deepCopy();
                if(!proposalId.equals(texto(p,"id")) || !"ready".equals(texto(p,"status"))) throw error("La propuesta aún no está lista.");
                ObjectNode draft=objeto(p.path("diagram"));
                try {validar(draft,e.official);} catch(ResponseStatusException ex) {
                    if(ex.getReason()!=null && ex.getReason().startsWith("Ya existe la clase")) p.put("conflict",ex.getReason()); else throw ex;
                }
                ubicar(draft,e.official);
                p.put("reviewRevision",0); p.put("moderationStatus","pending"); p.put("baseStructure",estructura(body.path("baseDiagram")));
                p.set("approvedClasses",mapper.createArrayNode()); p.set("approvedRelations",mapper.createArrayNode()); p.set("canonicalIds",mapper.createObjectNode());
                e.proposals.put(proposalId,p);
            }
        } else {
            if(p==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"La propuesta ya no está disponible. Solicita una nueva.");
            if(!Set.of("pending","partial").contains(texto(p,"moderationStatus"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"La propuesta ya fue resuelta.");
            if(body.path("expectedRevision").asLong(-1)!=p.path("reviewRevision").asLong()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Otro participante modificó la propuesta. Revisa la versión actual.");
            ObjectNode draft=objeto(p.path("diagram"));
            switch(action) {
                case "preview" -> { e.active=proposalId; }
                case "edit" -> {
                    ObjectNode edited=objeto(body.path("diagram")).deepCopy(); validar(edited,e.official); p.set("diagram",edited); p.remove("conflict");
                }
                case "rebase" -> {
                    try {
                        ObjectNode stored=objeto(mapper.readTree(diagramas.findById(id).orElseThrow().getJsonDiagrama()));
                        if(!estructura(stored).equals(e.persistedStructure)) {
                            e.persistedStructure=estructura(stored);e.revision=Math.max(e.revision,stored.path("_reviewRevision").asLong(0))+1;
                            stored.put("_reviewRevision",e.revision);e.official=stored;salas.actualizarDiagramaDeSala(room,stored);emitir(room,"diagrama",stored);
                            throw new ResponseStatusException(HttpStatus.CONFLICT,"Se recuperó un guardado de otra sesión. Revisa el modelo y vuelve a validar la propuesta.");
                        }
                    } catch(java.io.IOException ex) {throw error("No se pudo recuperar el modelo guardado.");}
                    validar(draft,e.official); p.put("baseStructure",estructura(e.official)); p.remove("conflict");
                }
                case "approve" -> {
                    if(!e.active.equals(proposalId)) throw error("Abre primero la propuesta en la pizarra.");
                    if(!texto(p,"baseStructure").equals(estructura(e.official))) throw new ResponseStatusException(HttpStatus.CONFLICT,"El diagrama cambió. Revisa los cambios y pulsa Validar contra el modelo actual.");
                    Map<String,String> mappings=new HashMap<>(); p.path("canonicalIds").fields().forEachRemaining(x->mappings.put(x.getKey(),x.getValue().asText()));
                    var fusion=fusionar(e.official,draft,seleccion(body,"classIds"),seleccion(body,"relationIds"),mappings);
                    ObjectNode official=fusion.official(); official.put("_reviewRevision",e.revision+1); official.put("updatedAt",java.time.Instant.now().toString());
                    persistencia.guardar(id,official,a.id,op,e.persistedStructure); // transaction completes before any shared state changes
                    e.revision++; e.official=official; e.persistedStructure=estructura(official);
                    p.set("diagram",fusion.pending()); p.set("canonicalIds",mapper.valueToTree(fusion.ids()));
                    for(JsonNode x:body.path("classIds")) ((ArrayNode)p.path("approvedClasses")).add(x.asText());
                    for(JsonNode x:body.path("relationIds")) ((ArrayNode)p.path("approvedRelations")).add(x.asText());
                    p.put("moderationStatus",fusion.pending().path("classes").isEmpty() && fusion.pending().path("relations").isEmpty()?"approved":"partial");
                    p.put("baseStructure",estructura(official));
                    salas.actualizarDiagramaDeSala(room,official);
                    emitir(room,"diagrama",official);
                }
                case "reject" -> {
                    p.put("moderationStatus",texto(body,"feedback").isBlank()?"rejected":"superseded");
                    p.put("feedback",texto(body,"feedback"));
                }
                default -> throw error("Acción de propuesta desconocida.");
            }
            p.put("reviewRevision",p.path("reviewRevision").asLong()+1); p.put("decidedBy",a.id); p.put("decidedAt",java.time.Instant.now().toString());
            if(!Set.of("pending","partial").contains(texto(p,"moderationStatus")) && e.active.equals(proposalId)) e.active="";
        }
        e.sequence++; e.results.put(cacheKey,mapper.createObjectNode());
        if(e.results.size()>2000) e.results.remove(e.results.keySet().iterator().next());
        ObjectNode result=snapshot(e); emitir(room,"ia_draft_state",result); result.put("canModerate",a.edit); return result;
    }
    /** All existing official room write paths pass through this fence once moderation starts. */
    public synchronized Object actualizarOficialConToken(String room,Object raw,String auth) {
        Estado e=estados.get(room);
        if(e!=null && !acceso(e.diagramId,auth).edit) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No tienes permiso para editar este diagrama.");
        return actualizarOficial(room,raw,e==null?null:acceso(e.diagramId,auth).id);
    }
    public synchronized Object actualizarOficial(String room,Object raw,String user) {
        Estado e=estados.get(room); if(e==null) {salas.actualizarDiagramaDeSala(room,raw);return raw;}
        if(user==null || !permisos(e.diagramId,user).edit) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"No tienes permiso para editar este diagrama.");
        ObjectNode n=objeto(mapper.valueToTree(raw));
        if(!n.has("_reviewRevision")) { emitir(room,"diagrama",e.official); return e.official.deepCopy(); }
        if(n.path("_reviewRevision").asLong(-1)!=e.revision) {
            emitir(room,"ia_review_conflict",Map.of("message","El diagrama cambió antes de recibir tu edición. Se recuperó la versión actual para evitar sobrescribir el trabajo del equipo."));
            emitir(room,"diagrama",e.official); return e.official.deepCopy();
        }
        if(!estructura(n).equals(estructura(e.official))) e.revision++;
        n.put("_reviewRevision",e.revision); e.official=n.deepCopy(); salas.actualizarDiagramaDeSala(room,n); return n;
    }
}
