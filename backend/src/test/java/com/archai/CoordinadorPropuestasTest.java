package com.archai;

import com.archai.modulo.colaboracion.servicio.CoordinadorPropuestas;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class CoordinadorPropuestasTest {
    @Test void soloAnfitrionPuedeCambiarElPermisoDeNube() {
        var c = new CoordinadorPropuestas();
        assertNull(c.procesar("a","ia_settings","dev",Map.of("enabled",true,"cloud",true),false));
        assertEquals(false,c.procesar("a","ia_sync","dev",Map.of(),false).get("cloud"));
        assertEquals(true,c.procesar("a","ia_settings","host",Map.of("enabled",true,"cloud",true),true).get("cloud"));
        assertEquals(false,c.procesar("b","ia_sync","dev",Map.of(),false).get("cloud"));
    }
    @Test void unaSolaRevisionPorSalaYResultadoSoloDelEjecutor() {
        var c = new CoordinadorPropuestas();
        var request = Map.<String,Object>of("id","p1","hash","diagram1");
        assertNotNull(c.procesar("a","ia_auto","host#1",request,true));
        assertNull(c.procesar("a","ia_auto","host#2",request,true));
        assertNotNull(c.procesar("b","ia_auto","host#2",request,true));
        var result = Map.<String,Object>of("id","p1","automatic",true);
        assertNull(c.procesar("a","ia_result","host#2",result,true));
        assertNotNull(c.procesar("a","ia_result","host#1",result,true));
        assertNull(c.procesar("a","ia_auto","host#1",request,true));
    }
    @Test void pausaImpideRevisionAutomatica() {
        var c = new CoordinadorPropuestas();
        c.procesar("a","ia_settings","host",Map.of("enabled",false,"cloud",false),true);
        assertNull(c.procesar("a","ia_auto","host",Map.of("id","p","hash","h"),true));
    }
}
