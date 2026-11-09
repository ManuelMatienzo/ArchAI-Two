package com.archai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.util.List;

@SpringBootApplication
@EntityScan(basePackages = "com.archai")
@EnableJpaRepositories(basePackages = "com.archai")
public class ArchAiApplication {

    public static void main(String[] args) {
        boolean isolated = java.util.Arrays.asList(args).contains("--spring.profiles.active=local-test")
                || "local-test".equals(System.getProperty("spring.profiles.active"))
                || "local-test".equals(System.getenv("SPRING_PROFILES_ACTIVE"));
        if (!isolated) {
            loadDotEnv();
            sanitizeAndApplyDatabaseProperties();
            checkAndFallbackIfUnreachable();
        }
        SpringApplication.run(ArchAiApplication.class, args);
    }

    private static void loadDotEnv() {
        String[] possiblePaths = { ".env", "backend/.env", "../.env", "ArchAI-App/backend/.env" };
        for (String pathStr : possiblePaths) {
            File f = new File(pathStr);
            if (f.exists() && f.isFile()) {
                try {
                    List<String> lines = Files.readAllLines(f.toPath());
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) continue;
                        int idx = line.indexOf('=');
                        String key = line.substring(0, idx).trim();
                        String value = line.substring(idx + 1).trim();
                        if ((value.startsWith("\"") && value.endsWith("\"")) || 
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.substring(1, value.length() - 1);
                        }
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                    System.out.println(" Variables de entorno cargadas exitosamente desde: " + f.getAbsolutePath());
                    break;
                } catch (Exception e) {
                    System.err.println(" Error al leer archivo .env: " + e.getMessage());
                }
            }
        }
    }

    private static void sanitizeAndApplyDatabaseProperties() {
        String dbUrl = System.getProperty("SPRING_DATASOURCE_URL");
        if (dbUrl == null) dbUrl = System.getenv("SPRING_DATASOURCE_URL");
        if (dbUrl == null) dbUrl = System.getProperty("DATABASE_URL");
        if (dbUrl == null) dbUrl = System.getenv("DATABASE_URL");

        if (dbUrl != null && (dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://"))) {
            try {
                URI uri = new URI(dbUrl);
                String userInfo = uri.getUserInfo();
                String host = uri.getHost();
                int port = uri.getPort() != -1 ? uri.getPort() : 5432;
                String path = uri.getPath();
                String query = uri.getQuery();

                String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path;
                if (query != null && !query.isEmpty()) {
                    jdbcUrl += "?" + query;
                } else {
                    jdbcUrl += "?sslmode=require";
                }
                System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);

                if (userInfo != null && userInfo.contains(":")) {
                    String[] userParts = userInfo.split(":", 2);
                    if (System.getProperty("SPRING_DATASOURCE_USERNAME") == null) {
                        System.setProperty("SPRING_DATASOURCE_USERNAME", userParts[0]);
                    }
                    if (System.getProperty("SPRING_DATASOURCE_PASSWORD") == null) {
                        System.setProperty("SPRING_DATASOURCE_PASSWORD", userParts[1]);
                    }
                }
                System.setProperty("SPRING_DATASOURCE_DRIVER", "org.postgresql.Driver");
            } catch (Exception e) {
                System.err.println(" Error al parsear DATABASE_URL: " + e.getMessage());
            }
        }
    }

    private static void checkAndFallbackIfUnreachable() {
        String dbUrl = System.getProperty("SPRING_DATASOURCE_URL");
        if (dbUrl == null) dbUrl = System.getenv("SPRING_DATASOURCE_URL");
        if (dbUrl == null || !dbUrl.contains("postgresql")) {
            return;
        }

        String host = null;
        int port = 5432;
        try {
            String clean = dbUrl.replace("jdbc:postgresql://", "").replace("postgresql://", "");
            int slashIdx = clean.indexOf('/');
            if (slashIdx != -1) clean = clean.substring(0, slashIdx);
            int atIdx = clean.indexOf('@');
            if (atIdx != -1) clean = clean.substring(atIdx + 1);
            int qIdx = clean.indexOf('?');
            if (qIdx != -1) clean = clean.substring(0, qIdx);

            if (clean.contains(":")) {
                String[] parts = clean.split(":");
                host = parts[0].trim();
                port = Integer.parseInt(parts[1].trim());
            } else {
                host = clean.trim();
            }
        } catch (Exception e) {
            System.err.println("⚠️  [ArchAI] Error al extraer host de la BD: " + e.getMessage());
        }

        if (host != null && !host.isEmpty() && !host.equals("localhost") && !host.equals("127.0.0.1")) {
            boolean reachable = false;
            try {
                // 1. Probar socket con timeout de 2s
                try (java.net.Socket socket = new java.net.Socket()) {
                    socket.connect(new java.net.InetSocketAddress(host, port), 2000);
                }

                // 2. Probar autenticación y sesión JDBC con timeout de 3s
                String user = System.getProperty("SPRING_DATASOURCE_USERNAME");
                if (user == null) user = System.getenv("SPRING_DATASOURCE_USERNAME");
                String pass = System.getProperty("SPRING_DATASOURCE_PASSWORD");
                if (pass == null) pass = System.getenv("SPRING_DATASOURCE_PASSWORD");

                java.sql.DriverManager.setLoginTimeout(3);
                try (java.sql.Connection conn = java.sql.DriverManager.getConnection(dbUrl, user, pass)) {
                    if (conn != null && !conn.isClosed()) {
                        reachable = true;
                    }
                }
            } catch (Throwable e) {
                System.out.println("⚠️  [ArchAI] Fallo al conectar/autenticar con PostgreSQL (" + e.getMessage() + ").");
                reachable = false;
            }

            if (!reachable) {
                System.out.println("⚠️  [ArchAI] La base de datos PostgreSQL remota (" + host + ":" + port + ") no está disponible o alcanzó su límite de sesiones.");
                System.out.println("🔄 [ArchAI] Fallback automático a H2 en memoria activado. El backend iniciará sin errores.");
                System.setProperty("SPRING_DATASOURCE_URL", "jdbc:h2:mem:archai_db;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
                System.setProperty("SPRING_DATASOURCE_USERNAME", "sa");
                System.setProperty("SPRING_DATASOURCE_PASSWORD", "");
                System.setProperty("SPRING_DATASOURCE_DRIVER", "org.h2.Driver");
                System.setProperty("SPRING_JPA_DATABASE_PLATFORM", "org.hibernate.dialect.H2Dialect");
                System.setProperty("SPRING_FLYWAY_ENABLED", "true");
            } else {
                System.out.println("✅ [ArchAI] Conexión establecida con la base de datos PostgreSQL (" + host + ":" + port + ").");
            }
        }
    }
}
