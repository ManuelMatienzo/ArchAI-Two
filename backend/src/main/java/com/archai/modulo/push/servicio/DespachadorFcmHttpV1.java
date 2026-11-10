package com.archai.modulo.push.servicio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * CU-23 — Canal Firebase Cloud Messaging (HTTP v1).
 *
 * <p><b>Punto único de integración de Firebase:</b> basta con definir la variable de entorno
 * {@code ARCHAI_PUSH_FCM_CREDENCIALES} con la ruta al JSON del service account (o su contenido
 * JSON/Base64) y poner {@code ARCHAI_PUSH_FCM_HABILITADO=true}. No se requiere añadir ninguna
 * dependencia Maven: la firma OAuth2 RS256 y la llamada HTTP/2 se hacen con el JDK.</p>
 *
 * <p>El cliente móvil obtiene el token FCM mediante {@code expo-notifications}
 * ({@code getDevicePushTokenAsync}) una vez agregado {@code google-services.json} al proyecto
 * Expo. Hasta entonces este canal queda en modo "omitido" y el registro sigue funcionando.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DespachadorFcmHttpV1 implements DespachadorPush {

    private final ObjectMapper objectMapper;

    @Value("${archai.push.fcm.habilitado:false}")
    private boolean habilitado;

    @Value("${archai.push.fcm.credenciales:}")
    private String credenciales;

    @Value("${archai.push.fcm.project-id:}")
    private String projectIdConfigurado;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    private volatile boolean cargaIntentada = false;
    private volatile boolean configurado = false;
    private volatile String projectId = "";
    private volatile String clientEmail = "";
    private volatile PrivateKey llavePrivada;
    private volatile String accessToken = "";
    private volatile Instant accessTokenExpira = Instant.EPOCH;

    @Override
    public String canal() {
        return "FCM";
    }

    @Override
    public boolean soporta(String token) {
        return token != null
                && !token.isBlank()
                && !token.startsWith("ExponentPushToken[")
                && !token.startsWith("ExpoPushToken[");
    }

    @Override
    public boolean estaConfigurado() {
        cargarCredenciales();
        return configurado;
    }

    @Override
    public boolean despachar(String token, MensajePush mensaje) {
        cargarCredenciales();
        if (!configurado) return false;

        try {
            String access = obtenerAccessToken();
            String cuerpo = construirMensaje(token, mensaje);
            String url = "https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send";

            HttpResponse<String> response = enviar(url, access, cuerpo);
            if (response.statusCode() == 401) {
                // Token OAuth2 caducado: se renueva una sola vez.
                this.accessToken = "";
                response = enviar(url, obtenerAccessToken(), cuerpo);
            }

            if (response.statusCode() / 100 != 2) {
                log.warn("[CU-23] FCM rechazó el envío ({}): {}", response.statusCode(), recortar(response.body()));
                return false;
            }
            return true;
        } catch (Exception e) {
            log.warn("[CU-23] Error al despachar FCM: {}", e.getMessage());
            return false;
        }
    }

    private String construirMensaje(String token, MensajePush mensaje) throws Exception {
        Map<String, Object> notification = new LinkedHashMap<>();
        notification.put("title", mensaje.titulo());
        notification.put("body", mensaje.cuerpo());

        Map<String, Object> androidNotification = new LinkedHashMap<>();
        androidNotification.put("channel_id", "archai-critical");
        androidNotification.put("sound", "default");
        androidNotification.put("color", "#38BDF8");

        Map<String, Object> android = new LinkedHashMap<>();
        android.put("priority", "HIGH");
        android.put("notification", androidNotification);

        Map<String, Object> aps = new LinkedHashMap<>();
        aps.put("sound", "default");
        aps.put("badge", 1);

        Map<String, Object> apns = new LinkedHashMap<>();
        apns.put("payload", Map.of("aps", aps));

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("token", token);
        message.put("notification", notification);
        if (mensaje.datos() != null && !mensaje.datos().isEmpty()) {
            message.put("data", mensaje.datos());
        }
        message.put("android", android);
        message.put("apns", apns);

        return objectMapper.writeValueAsString(Map.of("message", message));
    }

    private HttpResponse<String> enviar(String url, String access, String cuerpo) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + access)
                .header("Content-Type", "application/json; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(cuerpo, StandardCharsets.UTF_8))
                .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private void cargarCredenciales() {
        if (cargaIntentada) return;
        synchronized (this) {
            if (cargaIntentada) return;
            cargaIntentada = true;

            if (!habilitado) {
                log.info("[CU-23] FCM deshabilitado (ARCHAI_PUSH_FCM_HABILITADO=false).");
                return;
            }
            if (credenciales == null || credenciales.isBlank()) {
                log.info("[CU-23] FCM sin credenciales. Define ARCHAI_PUSH_FCM_CREDENCIALES con la ruta o el JSON del service account de Firebase.");
                return;
            }

            try {
                JsonNode root = objectMapper.readTree(leerCredenciales(credenciales.trim()));
                String email = root.path("client_email").asText("");
                String llave = root.path("private_key").asText("");
                String pid = (projectIdConfigurado != null && !projectIdConfigurado.isBlank())
                        ? projectIdConfigurado
                        : root.path("project_id").asText("");

                if (email.isBlank() || llave.isBlank() || pid.isBlank()) {
                    throw new IllegalStateException("el JSON no contiene client_email, private_key o project_id");
                }

                this.clientEmail = email;
                this.projectId = pid;
                this.llavePrivada = parsearLlave(llave);
                this.configurado = true;
                log.info("[CU-23] FCM configurado para el proyecto {} (remitente {}).", pid, email);
            } catch (Exception e) {
                log.warn("[CU-23] No se pudieron cargar las credenciales FCM: {}", e.getMessage());
            }
        }
    }

    private String leerCredenciales(String valor) throws Exception {
        if (valor.startsWith("{")) {
            return valor;
        }
        // Ruta a un archivo .json del service account
        if (valor.toLowerCase().endsWith(".json") || valor.contains("/") || valor.contains("\\")) {
            return Files.readString(Path.of(valor), StandardCharsets.UTF_8);
        }
        // Contenido JSON codificado en Base64 (útil en variables de entorno de la nube)
        try {
            String decodificado = new String(Base64.getDecoder().decode(valor), StandardCharsets.UTF_8);
            if (decodificado.trim().startsWith("{")) {
                return decodificado;
            }
        } catch (Exception ignored) {
        }
        return Files.readString(Path.of(valor), StandardCharsets.UTF_8);
    }

    private PrivateKey parsearLlave(String pem) throws Exception {
        String limpia = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(limpia);
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private String obtenerAccessToken() throws Exception {
        if (!accessToken.isBlank() && Instant.now().isBefore(accessTokenExpira.minusSeconds(60))) {
            return accessToken;
        }
        synchronized (this) {
            if (!accessToken.isBlank() && Instant.now().isBefore(accessTokenExpira.minusSeconds(60))) {
                return accessToken;
            }

            String assertion = firmarJwt();
            String formulario = "grant_type=" + codificar("urn:ietf:params:oauth:grant-type:jwt-bearer")
                    + "&assertion=" + codificar(assertion);

            HttpRequest request = HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formulario, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("OAuth2 respondió " + response.statusCode() + ": " + recortar(response.body()));
            }

            JsonNode body = objectMapper.readTree(response.body());
            String token = body.path("access_token").asText("");
            long expiraEn = body.path("expires_in").asLong(3600);
            if (token.isBlank()) {
                throw new IllegalStateException("OAuth2 no devolvió access_token");
            }

            this.accessToken = token;
            this.accessTokenExpira = Instant.now().plusSeconds(Math.max(60, expiraEn));
            return token;
        }
    }

    private String firmarJwt() throws Exception {
        long ahora = Instant.now().getEpochSecond();

        Map<String, Object> header = Map.of("alg", "RS256", "typ", "JWT");
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", clientEmail);
        claims.put("scope", "https://www.googleapis.com/auth/firebase.messaging");
        claims.put("aud", "https://oauth2.googleapis.com/token");
        claims.put("iat", ahora);
        claims.put("exp", ahora + 3600);

        String cabecera = base64Url(objectMapper.writeValueAsBytes(header));
        String cuerpo = base64Url(objectMapper.writeValueAsBytes(claims));
        String firma = base64Url(firmar((cabecera + "." + cuerpo).getBytes(StandardCharsets.US_ASCII)));
        return cabecera + "." + cuerpo + "." + firma;
    }

    private byte[] firmar(byte[] datos) throws Exception {
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(llavePrivada);
        signature.update(datos);
        return signature.sign();
    }

    private String base64Url(byte[] datos) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(datos);
    }

    private String codificar(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    private String recortar(String valor) {
        if (valor == null) return "";
        return valor.substring(0, Math.min(300, valor.length()));
    }
}
