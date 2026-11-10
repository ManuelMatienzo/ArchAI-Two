package com.archai;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.util.List;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(exclude = org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration.class)
@EntityScan(basePackages = "com.archai")
@EnableJpaRepositories(basePackages = "com.archai")
public class ArchAiApplication {

    public static void main(String[] args) {
        com.archai.comun.configuracion.EntornoIa.cargar();
        boolean isolated =
            java.util.Arrays.stream(args).anyMatch(
                a ->
                    a.startsWith("--spring.profiles.active=") &&
                    java.util.Arrays.asList(a.substring(a.indexOf('=') + 1).split(",")).contains("local-test")
            ) ||
            "local-test".equals(System.getProperty("spring.profiles.active")) ||
            "local-test".equals(System.getenv("SPRING_PROFILES_ACTIVE"));
        if (!isolated) {
            loadDotEnv();
            sanitizeAndApplyDatabaseProperties();
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
                        if (
                            (value.startsWith("\"") && value.endsWith("\"")) ||
                            (value.startsWith("'") && value.endsWith("'"))
                        ) {
                            value = value.substring(1, value.length() - 1);
                        }
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                    System.out.println(" Variables de entorno cargadas exitosamente desde: " + f.getAbsolutePath());
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
                System.err.println(
                    " No se pudo interpretar DATABASE_URL. Revisa su formato en la configuración privada."
                );
            }
        }
    }
}
