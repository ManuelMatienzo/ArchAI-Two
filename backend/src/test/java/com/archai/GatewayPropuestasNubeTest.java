package com.archai;

import com.archai.modulo.ia.servicio.*;
import com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GatewayPropuestasNubeTest {
    final ObjectMapper mapper=new ObjectMapper();
    HttpServer server;MockEnvironment env;ServicioRevisionPropuesta reviews;
    GatewayPropuestasNube gateway;final AtomicInteger gemini=new AtomicInteger(),claude=new AtomicInteger();
    volatile int geminiStatus=200; volatile boolean invalid,slow,refusal;
    volatile JsonNode claudeBody;
    final String valid="{\"explanation\":\"Separar citas.\",\"classes\":[{\"name\":\"Cita\",\"attributes\":[{\"name\":\"id\",\"type\":\"Long\"}],\"methods\":[]}],\"relations\":[{\"sourceName\":\"Paciente\",\"targetName\":\"Cita\",\"type\":\"ASSOCIATION_1_N\"}]}";
    @BeforeEach void setup() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/gemini",e->{try{
            gemini.incrementAndGet(); if(slow)Thread.sleep(1200);
            String text=invalid?valid.replace("ASSOCIATION_1_N","INVALID"):valid;
            ObjectNode body=mapper.createObjectNode();
            body.putArray("candidates").addObject().put("finishReason",refusal?"SAFETY":"STOP").putObject("content").putArray("parts").addObject().put("text",text);
            byte[] bytes=body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);e.sendResponseHeaders(geminiStatus,bytes.length);e.getResponseBody().write(bytes);
        }catch(Exception ignored){}finally{e.close();}});
        server.createContext("/claude",e->{try{
            claude.incrementAndGet();claudeBody=mapper.readTree(e.getRequestBody());
            ObjectNode body=mapper.createObjectNode().put("stop_reason","end_turn");body.putArray("content").addObject().put("type","text").put("text",valid);
            byte[] bytes=body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);
        }finally{e.close();}});
        server.start();String base="http://127.0.0.1:"+server.getAddress().getPort();
        env=new MockEnvironment().withProperty("GEMINI_API_KEY","dummy").withProperty("ANTHROPIC_API_KEY","dummy").withProperty("ARCHAI_CLAUDE_FALLBACK_ENABLED","true").withProperty("archai.ia.gemini-url",base+"/gemini").withProperty("archai.ia.claude-url",base+"/claude");
        env.setActiveProfiles("local-test");env.setProperty("ARCHAI_AI_TEST_CONTROLS","true");
        reviews=mock(ServicioRevisionPropuesta.class);when(reviews.autorizarInferencia(anyString(),anyString(),anyString())).thenReturn("owner");
        gateway=new GatewayPropuestasNube(new ClientePropuestasNube(env,mapper),reviews,mapper);
    }
    @AfterEach void close(){server.stop(0);}
    ObjectNode options(){return mapper.createObjectNode();}
    void register(String room,String id,boolean automatic)throws Exception {
        ObjectNode p=mapper.createObjectNode().put("id",id).put("diagramId","diagram").put("prompt","Añade Cita");
        p.set("baseDiagram",mapper.readTree("{\"classes\":[{\"id\":\"paciente\",\"name\":\"Paciente\",\"attributes\":[],\"methods\":[]}],\"relations\":[]}"));gateway.register(room,"owner",p,automatic);
    }
    @Test void geminiPrimeroYReintentoNoFacturaDosVeces()throws Exception {
        register("room","one",false);var a=gateway.infer("room","one","auth",options());var b=gateway.infer("room","one","auth",options());
        assertEquals(a,b);assertEquals("Gemini",a.path("provider").asText());assertEquals(1,gemini.get());assertEquals(0,claude.get());
        assertThrows(ResponseStatusException.class,()->gateway.infer("other","one","auth",options()));
    }
    @Test void cuotaActivaClaudeYOmiteGeminiEnSiguienteConsulta()throws Exception {
        geminiStatus=429;register("room","one",false);assertEquals("Claude",gateway.infer("room","one","auth",options()).path("provider").asText());
        register("room","two",false);gateway.infer("room","two","auth",options());assertEquals(1,gemini.get());assertEquals(2,claude.get());
        assertEquals("between_tools",claudeBody.path("thinking").path("type").asText());assertFalse(claudeBody.has("temperature"));
        assertEquals("json_schema",claudeBody.path("output_config").path("format").path("type").asText());
        assertTrue(claudeBody.path("output_config").path("format").path("schema").path("required").toString().contains("relations"));
    }
    @Test void automaticasNoConsumenClaudeNiConOverride()throws Exception {
        geminiStatus=429;register("room","auto",true);
        assertThrows(ResponseStatusException.class,()->gateway.infer("room","auto","auth",options().put("provider","claude")));
        assertThrows(ResponseStatusException.class,()->gateway.infer("room","auto","auth",options()));assertEquals(0,claude.get());
    }
    @Test void jsonConRelacionInvalidaActivaRespaldo()throws Exception {
        invalid=true;register("room","one",false);assertEquals("Claude",gateway.infer("room","one","auth",options()).path("provider").asText());assertEquals(1,claude.get());
    }
    @Test void erroresDePermisoYRechazosNoActivanRespaldo()throws Exception {
        geminiStatus=403;register("room","one",false);assertThrows(ResponseStatusException.class,()->gateway.infer("room","one","auth",options()));assertEquals(0,claude.get());
        geminiStatus=200;refusal=true;register("room","two",false);assertThrows(ResponseStatusException.class,()->gateway.infer("room","two","auth",options()));assertEquals(0,claude.get());
    }
    @Test void produccionRechazaOverrideYCancelacionNoConsume()throws Exception {
        env.setActiveProfiles("production");register("room","one",false);
        assertEquals(false,gateway.config().get("testControls"));assertThrows(ResponseStatusException.class,()->gateway.infer("room","one","auth",options().put("provider","claude")));
        gateway.cancel("room","one","auth");assertThrows(ResponseStatusException.class,()->gateway.infer("room","one","auth",options()));assertEquals(0,gemini.get());assertEquals(0,claude.get());
    }
    @Test void dosClientesConcurrentesReutilizanUnaLlamada()throws Exception {
        slow=true;register("room","one",false);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->gateway.infer("room","one","auth",options()));var b=pool.submit(()->gateway.infer("room","one","auth",options()));assertEquals(a.get(5,TimeUnit.SECONDS),b.get(5,TimeUnit.SECONDS));assertEquals(1,gemini.get());}finally{pool.shutdownNow();}
    }
    @Test void timeoutGeminiEntraClaude()throws Exception {
        env.setProperty("archai.ia.gemini-timeout-seconds","1");slow=true;register("room","one",false);
        assertEquals("Claude",gateway.infer("room","one","auth",options()).path("provider").asText());
    }
    @Test void otroSolicitanteNoPuedeGastarSaldo()throws Exception {
        register("room","one",false);when(reviews.autorizarInferencia("room","diagram","intruder")).thenReturn("other");
        assertThrows(ResponseStatusException.class,()->gateway.infer("room","one","intruder",options()));assertEquals(0,gemini.get());
    }
    @Test void respaldoDeshabilitadoYFalloDeAmbosNoReintentan()throws Exception {
        geminiStatus=503;env.setProperty("ARCHAI_CLAUDE_FALLBACK_ENABLED","false");register("room","one",false);
        assertThrows(ResponseStatusException.class,()->gateway.infer("room","one","auth",options()));assertEquals(0,claude.get());
        env.setProperty("ARCHAI_CLAUDE_FALLBACK_ENABLED","true");env.setProperty("ANTHROPIC_API_KEY","");register("room","two",false);
        assertThrows(ResponseStatusException.class,()->gateway.infer("room","two","auth",options()));assertEquals(0,claude.get());
    }
    @Test void cancelarGeminiEnCursoNoActivaClaude()throws Exception {
        slow=true;register("room","one",false);var pool=Executors.newSingleThreadExecutor();
        try{
            var pending=pool.submit(()->gateway.infer("room","one","auth",options()));
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
            while(gemini.get()==0 && System.nanoTime()<deadline)Thread.sleep(10);
            assertEquals(1,gemini.get());gateway.cancel("room","one","auth");
            assertThrows(ExecutionException.class,()->pending.get(3,TimeUnit.SECONDS));assertEquals(0,claude.get());
        }finally{pool.shutdownNow();}
    }
}
