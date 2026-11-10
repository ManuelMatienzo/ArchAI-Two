package com.archai.modulo.push.servicio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CU-23 — Canal Expo Push (sin credenciales).
 *
 * <p>Se usa cuando el dispositivo entrega un `ExponentPushToken[...]`. Es útil para validar
 * el flujo completo en development builds antes de conectar Firebase. En Expo Go (SDK 53+)
 * el push remoto no está disponible, por lo que el servicio responderá con error y el
 * registro seguirá siendo válido para cuando se use un build con FCM.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DespachadorExpoPush implements DespachadorPush {

    private final ObjectMapper objectMapper;

    @Value("${archai.push.expo.habilitado:true}")
    private boolean habilitado;

    @Value("${archai.push.expo.url:https://exp.host/--/api/v2/push/send}")
    private String url;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    @Override
    public String canal() {
        return "EXPO";
    }

    @Override
    public boolean soporta(String token) {
        return token != null
                && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
    }

    @Override
    public boolean estaConfigurado() {
        return habilitado && url != null && !url.isBlank();
    }

    @Override
    public boolean despachar(String token, MensajePush mensaje) {
        if (!estaConfigurado()) return false;

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("to", token);
            payload.put("title", mensaje.titulo());
            payload.put("body", mensaje.cuerpo());
            payload.put("sound", "default");
            payload.put("priority", "high");
            payload.put("channelId", "archai-critical");
            if (mensaje.datos() != null && !mensaje.datos().isEmpty()) {
                payload.put("data", mensaje.datos());
            }

            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                log.warn("[CU-23] Expo Push rechazó el envío ({}): {}", response.statusCode(), recortar(response.body()));
                return false;
            }

            JsonNode body = objectMapper.readTree(response.body());
            JsonNode data = body.path("data");
            if (data.isArray() && data.size() > 0) {
                data = data.get(0);
            }
            String estado = data.path("status").asText("");
            if ("error".equalsIgnoreCase(estado)) {
                log.warn("[CU-23] Expo Push devolvió error: {}", recortar(data.path("message").asText("")));
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("[CU-23] Error al despachar Expo Push: {}", e.getMessage());
            return false;
        }
    }

    private String recortar(String valor) {
        if (valor == null) return "";
        return valor.substring(0, Math.min(300, valor.length()));
    }
}
