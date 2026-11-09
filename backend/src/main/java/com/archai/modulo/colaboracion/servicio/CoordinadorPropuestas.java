package com.archai.modulo.colaboracion.servicio;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Estado efímero CU-15; no modifica la persistencia del diagrama. */
@Service
public class CoordinadorPropuestas {
    private final Map<String, Estado> salas = new ConcurrentHashMap<>();
    private static class Estado {
        boolean enabled = true, cloud = false;
        long last = 0, until = 0;
        String hash = "", owner = "", request = "";
    }
    public synchronized Map<String,Object> procesar(String sala, String tipo, String emisor, Map<String,Object> payload, boolean host) {
        Estado e = salas.computeIfAbsent(sala, key -> new Estado());
        if ("ia_settings".equals(tipo)) {
            if (!host) return null;
            e.enabled = Boolean.TRUE.equals(payload.get("enabled"));
            e.cloud = Boolean.TRUE.equals(payload.get("cloud"));
        }
        if ("ia_settings".equals(tipo) || "ia_sync".equals(tipo)) return Map.of("enabled",e.enabled,"cloud",e.cloud);
        if ("ia_auto".equals(tipo)) {
            long now = System.currentTimeMillis();
            String hash = String.valueOf(payload.get("hash"));
            if (!host || !e.enabled || now < e.until || now-e.last < 30000 || hash.equals(e.hash)) return null;
            e.last = now; e.until = now+70000; e.hash = hash; e.owner = emisor; e.request = String.valueOf(payload.get("id"));
        }
        if ("ia_result".equals(tipo) && Boolean.TRUE.equals(payload.get("automatic"))) {
            if (!emisor.equals(e.owner) || !Objects.equals(payload.get("id"),e.request)) return null;
            e.until = 0;
        }
        return payload;
    }
}
