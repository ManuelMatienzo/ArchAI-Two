package com.archai.modulo.generador.servicio;

import com.archai.modulo.diagrama.dto.DiagramDto;
import com.archai.modulo.diagrama.dto.UmlAttributeDto;
import com.archai.modulo.diagrama.dto.UmlClassDto;
import com.archai.modulo.diagrama.dto.UmlRelationDto;
import com.archai.modulo.generador.dto.GeneratedFileDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ServicioGeneradorSpringBoot {

    public List<GeneratedFileDto> generateProjectFiles(DiagramDto diagram) {
        List<GeneratedFileDto> files = new ArrayList<>();
        String basePackage = "com.archai.generated";
        String packagePath = "src/main/java/com/archai/generated/";

        files.add(generatePomXml(diagram));
        files.add(generateApplicationProperties(diagram));
        files.add(generateApplicationClass(diagram, basePackage, packagePath));

        if (diagram.getClasses() != null) {
            for (UmlClassDto cls : diagram.getClasses()) {
                files.add(generateEntity(cls, diagram, basePackage, packagePath));
                files.add(generateRepository(cls, diagram, basePackage, packagePath));
                files.add(generateService(cls, diagram, basePackage, packagePath));
                files.add(generateController(cls, diagram, basePackage, packagePath));
                files.add(generateDto(cls, diagram, basePackage, packagePath));
            }
        }

        files.add(generateCorsConfig(basePackage, packagePath));
        files.add(generateGlobalExceptionHandler(basePackage, packagePath));
        files.add(generateSwaggerConfig(basePackage, packagePath));

        return files;
    }

    private GeneratedFileDto generatePomXml(DiagramDto diagram) {
        String artifactId = diagram.getTitle() != null
                ? diagram.getTitle().toLowerCase().replaceAll("[^a-z0-9_-]", "-")
                : "archai-generated-api";

        String content = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" +
                "<project xmlns=\"http://maven.apache.org/POM/4.0.0\"\n" +
                "         xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n" +
                "         xsi:schemaLocation=\"http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd\">\n" +
                "    <modelVersion>4.0.0</modelVersion>\n" +
                "    <parent>\n" +
                "        <groupId>org.springframework.boot</groupId>\n" +
                "        <artifactId>spring-boot-starter-parent</artifactId>\n" +
                "        <version>3.2.3</version>\n" +
                "        <relativePath/>\n" +
                "    </parent>\n" +
                "    <groupId>com.archai.generated</groupId>\n" +
                "    <artifactId>" + artifactId + "</artifactId>\n" +
                "    <version>1.0.0-SNAPSHOT</version>\n" +
                "    <name>" + artifactId + "</name>\n" +
                "    <description>Clean Architecture REST API generada autom\u00e1ticamente por ArchAI CASE</description>\n" +
                "    <properties>\n" +
                "        <java.version>17</java.version>\n" +
                "        <springdoc.version>2.3.0</springdoc.version>\n" +
                "    </properties>\n" +
                "    <dependencies>\n" +
                "        <dependency>\n" +
                "            <groupId>org.springframework.boot</groupId>\n" +
                "            <artifactId>spring-boot-starter-web</artifactId>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.springframework.boot</groupId>\n" +
                "            <artifactId>spring-boot-starter-data-jpa</artifactId>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.springframework.boot</groupId>\n" +
                "            <artifactId>spring-boot-starter-validation</artifactId>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.postgresql</groupId>\n" +
                "            <artifactId>postgresql</artifactId>\n" +
                "            <scope>runtime</scope>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>com.h2database</groupId>\n" +
                "            <artifactId>h2</artifactId>\n" +
                "            <scope>runtime</scope>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.projectlombok</groupId>\n" +
                "            <artifactId>lombok</artifactId>\n" +
                "            <optional>true</optional>\n" +
                "        </dependency>\n" +
                "        <dependency>\n" +
                "            <groupId>org.springdoc</groupId>\n" +
                "            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>\n" +
                "            <version>${springdoc.version}</version>\n" +
                "        </dependency>\n" +
                "    </dependencies>\n" +
                "    <build>\n" +
                "        <plugins>\n" +
                "            <plugin>\n" +
                "                <groupId>org.springframework.boot</groupId>\n" +
                "                <artifactId>spring-boot-maven-plugin</artifactId>\n" +
                "                <configuration>\n" +
                "                    <excludes>\n" +
                "                        <exclude>\n" +
                "                            <groupId>org.projectlombok</groupId>\n" +
                "                            <artifactId>lombok</artifactId>\n" +
                "                        </exclude>\n" +
                "                    </excludes>\n" +
                "                </configuration>\n" +
                "            </plugin>\n" +
                "        </plugins>\n" +
                "    </build>\n" +
                "</project>\n";

        return GeneratedFileDto.builder()
                .filename("pom.xml")
                .path("pom.xml")
                .language("xml")
                .content(content)
                .build();
    }

    private GeneratedFileDto generateApplicationProperties(DiagramDto diagram) {
        String content = "server.port=8080\n" +
                "spring.application.name=" + (diagram.getTitle() != null ? diagram.getTitle().replaceAll("\\s+", "_") : "ArchAI_App") + "\n\n" +
                "# Conexión a Base de Datos (PostgreSQL en prod con fallback automático a H2 en memoria para pruebas locales)\n" +
                "spring.datasource.url=${DATABASE_URL:jdbc:h2:mem:archai_db;DB_CLOSE_DELAY=-1;MODE=PostgreSQL}\n" +
                "spring.datasource.driver-class-name=${DATABASE_DRIVER:org.h2.Driver}\n" +
                "spring.datasource.username=${DATABASE_USER:sa}\n" +
                "spring.datasource.password=${DATABASE_PASSWORD:}\n\n" +
                "# Hibernate JPA\n" +
                "spring.jpa.hibernate.ddl-auto=update\n" +
                "spring.jpa.show-sql=true\n" +
                "spring.jpa.properties.hibernate.format_sql=true\n";

        return GeneratedFileDto.builder()
                .filename("application.properties")
                .path("src/main/resources/application.properties")
                .language("properties")
                .content(content)
                .build();
    }

    private GeneratedFileDto generateApplicationClass(DiagramDto diagram, String basePackage, String packagePath) {
        String content = "package " + basePackage + ";\n\n" +
                "import org.springframework.boot.SpringApplication;\n" +
                "import org.springframework.boot.autoconfigure.SpringBootApplication;\n\n" +
                "@SpringBootApplication\n" +
                "public class Application {\n" +
                "    public static void main(String[] args) {\n" +
                "        SpringApplication.run(Application.class, args);\n" +
                "    }\n" +
                "}\n";

        return GeneratedFileDto.builder()
                .filename("Application.java")
                .path(packagePath + "Application.java")
                .language("java")
                .content(content)
                .build();
    }

    private GeneratedFileDto generateEntity(UmlClassDto cls, DiagramDto diagram, String basePackage, String packagePath) {
        String className = capitalize(cls.getName());
        String tableName = toSnakeCase(className) + "s";

        StringBuilder sb = new StringBuilder();
        sb.append("package ").append(basePackage).append(".domain.entity;\n\n");
        sb.append("import jakarta.persistence.*;\n");
        sb.append("import lombok.*;\n");
        sb.append("import com.fasterxml.jackson.annotation.JsonIgnoreProperties;\n");
        sb.append("import java.time.LocalDateTime;\n");
        sb.append("import java.time.LocalDate;\n");
        sb.append("import java.util.List;\n\n");
        sb.append("/**\n * Entidad JPA para la tabla '").append(tableName).append("'.\n */\n");
        sb.append("@Entity\n");
        sb.append("@Table(name = \"").append(tableName).append("\")\n");
        sb.append("@JsonIgnoreProperties({\"hibernateLazyInitializer\", \"handler\"})\n");
        sb.append("@Getter\n@Setter\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\n");
        sb.append("public class ").append(className).append(" {\n\n");

        boolean hasId = false;
        if (cls.getAttributes() != null) {
            for (UmlAttributeDto attr : cls.getAttributes()) {
                String fieldName = uncapitalize(attr.getName());
                String javaType = mapToJavaType(attr.getType());
                if (attr.isPrimaryKey() || "id".equalsIgnoreCase(fieldName)) {
                    hasId = true;
                    sb.append("    @Id\n");
                    sb.append("    @GeneratedValue(strategy = GenerationType.IDENTITY)\n");
                    sb.append("    @Column(name = \"").append(toSnakeCase(fieldName)).append("\")\n");
                    sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n\n");
                } else {
                    sb.append("    @Column(name = \"").append(toSnakeCase(fieldName)).append("\")\n");
                    sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n\n");
                }
            }
        }

        if (!hasId) {
            sb.append("    @Id\n");
            sb.append("    @GeneratedValue(strategy = GenerationType.IDENTITY)\n");
            sb.append("    @Column(name = \"id\")\n");
            sb.append("    private Long id;\n\n");
        }

        // Relaciones Salientes (1:N)
        if (diagram.getRelations() != null) {
            for (UmlRelationDto rel : diagram.getRelations()) {
                if (cls.getId() != null && cls.getId().equals(rel.getSourceClassId())) {
                    UmlClassDto targetCls = findClassById(diagram, rel.getTargetClassId());
                    if (targetCls != null) {
                        String targetClass = capitalize(targetCls.getName());
                        String targetVar = uncapitalize(targetClass);
                        sb.append("    // Relación UML: 1:N hacia ").append(targetClass).append("\n");
                        sb.append("    @OneToMany(mappedBy = \"").append(uncapitalize(className)).append("\", cascade = CascadeType.ALL, orphanRemoval = true)\n");
                        sb.append("    @Builder.Default\n");
                        sb.append("    private List<").append(targetClass).append("> ").append(targetVar).append("List = new java.util.ArrayList<>();\n\n");
                    }
                }
            }
            // Relaciones Entrantes (N:1)
            for (UmlRelationDto rel : diagram.getRelations()) {
                if (cls.getId() != null && cls.getId().equals(rel.getTargetClassId())) {
                    UmlClassDto sourceCls = findClassById(diagram, rel.getSourceClassId());
                    if (sourceCls != null) {
                        String sourceClass = capitalize(sourceCls.getName());
                        String sourceVar = uncapitalize(sourceClass);
                        String fkCol = toSnakeCase(sourceClass) + "_id";
                        sb.append("    // Relación UML: Referencia N:1 desde ").append(sourceClass).append("\n");
                        sb.append("    @ManyToOne(fetch = FetchType.LAZY)\n");
                        sb.append("    @JoinColumn(name = \"").append(fkCol).append("\")\n");
                        sb.append("    @JsonIgnoreProperties(\"").append(uncapitalize(className)).append("List\")\n");
                        sb.append("    private ").append(sourceClass).append(" ").append(sourceVar).append(";\n\n");
                    }
                }
            }
        }

        // Métodos de negocio UML
        if (cls.getMethods() != null && !cls.getMethods().isEmpty()) {
            sb.append("    // Métodos de negocio UML declarados en el diagrama\n");
            for (com.archai.modulo.diagrama.dto.UmlMethodDto m : cls.getMethods()) {
                String retType = m.getReturnType() != null && !m.getReturnType().isBlank() ? m.getReturnType() : "void";
                sb.append("    public ").append(retType).append(" ").append(m.getName()).append("() {\n");
                if ("void".equalsIgnoreCase(retType)) {
                    sb.append("        // Operación de negocio UML: ").append(m.getName()).append("\n");
                } else if ("boolean".equalsIgnoreCase(retType) || "Boolean".equalsIgnoreCase(retType)) {
                    sb.append("        return true;\n");
                } else {
                    sb.append("        return null;\n");
                }
                sb.append("    }\n\n");
            }
        }

        sb.append("}\n");

        return GeneratedFileDto.builder()
                .filename(className + ".java")
                .path(packagePath + "domain/entity/" + className + ".java")
                .language("java")
                .content(sb.toString())
                .build();
    }

    private GeneratedFileDto generateRepository(UmlClassDto cls, DiagramDto diagram, String basePackage, String packagePath) {
        String className = capitalize(cls.getName());
        String repoName = className + "Repository";

        StringBuilder sb = new StringBuilder();
        sb.append("package ").append(basePackage).append(".repository;\n\n");
        sb.append("import ").append(basePackage).append(".domain.entity.").append(className).append(";\n");
        sb.append("import org.springframework.data.jpa.repository.JpaRepository;\n");
        sb.append("import org.springframework.stereotype.Repository;\n");
        sb.append("import java.util.List;\n\n");
        sb.append("/**\n * Repositorio Spring Data JPA para ").append(className).append(".\n */\n");
        sb.append("@Repository\n");
        sb.append("public interface ").append(repoName).append(" extends JpaRepository<").append(className).append(", Long> {\n");

        if (diagram.getRelations() != null) {
            for (UmlRelationDto rel : diagram.getRelations()) {
                if (cls.getId() != null && cls.getId().equals(rel.getTargetClassId())) {
                    UmlClassDto sourceCls = findClassById(diagram, rel.getSourceClassId());
                    if (sourceCls != null) {
                        String sourceClass = capitalize(sourceCls.getName());
                        sb.append("    List<").append(className).append("> findBy").append(sourceClass).append("_Id(Long ").append(uncapitalize(sourceClass)).append("Id);\n");
                    }
                }
            }
        }

        sb.append("}\n");

        return GeneratedFileDto.builder()
                .filename(repoName + ".java")
                .path(packagePath + "repository/" + repoName + ".java")
                .language("java")
                .content(sb.toString())
                .build();
    }

    private GeneratedFileDto generateService(UmlClassDto cls, DiagramDto diagram, String basePackage, String packagePath) {
        String className = capitalize(cls.getName());
        String serviceName = className + "Service";
        String repoName = className + "Repository";
        String repoVar = uncapitalize(repoName);

        StringBuilder sb = new StringBuilder();
        sb.append("package ").append(basePackage).append(".service;\n\n");
        sb.append("import ").append(basePackage).append(".domain.entity.").append(className).append(";\n");
        sb.append("import ").append(basePackage).append(".repository.").append(repoName).append(";\n");
        sb.append("import lombok.RequiredArgsConstructor;\n");
        sb.append("import org.springframework.stereotype.Service;\n");
        sb.append("import org.springframework.transaction.annotation.Transactional;\n\n");
        sb.append("import java.util.List;\n");
        sb.append("import java.util.Optional;\n\n");
        sb.append("/**\n * Servicio de lógica de negocio para ").append(className).append(".\n */\n");
        sb.append("@Service\n");
        sb.append("@RequiredArgsConstructor\n");
        sb.append("@Transactional\n");
        sb.append("public class ").append(serviceName).append(" {\n\n");
        sb.append("    private final ").append(repoName).append(" ").append(repoVar).append(";\n\n");
        sb.append("    @Transactional(readOnly = true)\n");
        sb.append("    public List<").append(className).append("> findAll() {\n");
        sb.append("        return ").append(repoVar).append(".findAll();\n");
        sb.append("    }\n\n");
        sb.append("    @Transactional(readOnly = true)\n");
        sb.append("    public Optional<").append(className).append("> findById(Long id) {\n");
        sb.append("        return ").append(repoVar).append(".findById(id);\n");
        sb.append("    }\n\n");
        sb.append("    public ").append(className).append(" save(").append(className).append(" entity) {\n");
        sb.append("        return ").append(repoVar).append(".save(entity);\n");
        sb.append("    }\n\n");
        sb.append("    public void deleteById(Long id) {\n");
        sb.append("        ").append(repoVar).append(".deleteById(id);\n");
        sb.append("    }\n");

        if (cls.getMethods() != null && !cls.getMethods().isEmpty()) {
            sb.append("\n    // Operaciones de negocio derivadas del diagrama UML\n");
            for (com.archai.modulo.diagrama.dto.UmlMethodDto m : cls.getMethods()) {
                String retType = m.getReturnType() != null && !m.getReturnType().isBlank() ? m.getReturnType() : "void";
                sb.append("    public ").append(retType).append(" ").append(m.getName()).append("(Long id) {\n");
                sb.append("        ").append(className).append(" entity = ").append(repoVar).append(".findById(id)\n");
                sb.append("                .orElseThrow(() -> new IllegalArgumentException(\"").append(className).append(" no encontrado con ID: \" + id));\n");
                if ("void".equalsIgnoreCase(retType)) {
                    sb.append("        entity.").append(m.getName()).append("();\n");
                    sb.append("        ").append(repoVar).append(".save(entity);\n");
                } else {
                    sb.append("        ").append(retType).append(" res = entity.").append(m.getName()).append("();\n");
                    sb.append("        ").append(repoVar).append(".save(entity);\n");
                    sb.append("        return res;\n");
                }
                sb.append("    }\n\n");
            }
        }

        sb.append("}\n");

        return GeneratedFileDto.builder()
                .filename(serviceName + ".java")
                .path(packagePath + "service/" + serviceName + ".java")
                .language("java")
                .content(sb.toString())
                .build();
    }

    private GeneratedFileDto generateController(UmlClassDto cls, DiagramDto diagram, String basePackage, String packagePath) {
        String className = capitalize(cls.getName());
        String controllerName = className + "Controller";
        String serviceName = className + "Service";
        String serviceVar = uncapitalize(serviceName);
        String endpoint = toKebabCase(className) + "s";

        StringBuilder sb = new StringBuilder();
        sb.append("package ").append(basePackage).append(".controller;\n\n");
        sb.append("import ").append(basePackage).append(".domain.entity.").append(className).append(";\n");
        sb.append("import ").append(basePackage).append(".service.").append(serviceName).append(";\n");
        sb.append("import lombok.RequiredArgsConstructor;\n");
        sb.append("import org.springframework.http.ResponseEntity;\n");
        sb.append("import org.springframework.web.bind.annotation.*;\n\n");
        sb.append("import java.util.List;\n\n");
        sb.append("/**\n * Endpoints REST para ").append(className).append(".\n */\n");
        sb.append("@RestController\n");
        sb.append("@RequestMapping(\"/api/v1/").append(endpoint).append("\")\n");
        sb.append("@RequiredArgsConstructor\n");
        sb.append("@CrossOrigin(originPatterns = \"*\")\n");
        sb.append("public class ").append(controllerName).append(" {\n\n");
        sb.append("    private final ").append(serviceName).append(" ").append(serviceVar).append(";\n\n");
        sb.append("    @GetMapping\n");
        sb.append("    public ResponseEntity<List<").append(className).append(">> getAll() {\n");
        sb.append("        return ResponseEntity.ok(").append(serviceVar).append(".findAll());\n");
        sb.append("    }\n\n");
        sb.append("    @GetMapping(\"/{id}\")\n");
        sb.append("    public ResponseEntity<").append(className).append("> getById(@PathVariable Long id) {\n");
        sb.append("        return ").append(serviceVar).append(".findById(id)\n");
        sb.append("                .map(ResponseEntity::ok)\n");
        sb.append("                .orElse(ResponseEntity.notFound().build());\n");
        sb.append("    }\n\n");
        sb.append("    @PostMapping\n");
        sb.append("    public ResponseEntity<").append(className).append("> create(@RequestBody ").append(className).append(" entity) {\n");
        sb.append("        return ResponseEntity.ok(").append(serviceVar).append(".save(entity));\n");
        sb.append("    }\n\n");
        sb.append("    @DeleteMapping(\"/{id}\")\n");
        sb.append("    public ResponseEntity<Void> delete(@PathVariable Long id) {\n");
        sb.append("        ").append(serviceVar).append(".deleteById(id);\n");
        sb.append("        return ResponseEntity.noContent().build();\n");
        sb.append("    }\n");

        if (cls.getMethods() != null && !cls.getMethods().isEmpty()) {
            sb.append("\n    // Endpoints REST para operaciones de negocio UML\n");
            for (com.archai.modulo.diagrama.dto.UmlMethodDto m : cls.getMethods()) {
                String actionPath = toKebabCase(m.getName());
                sb.append("    @PostMapping(\"/{id}/").append(actionPath).append("\")\n");
                sb.append("    public ResponseEntity<?> execute").append(capitalize(m.getName())).append("(@PathVariable Long id) {\n");
                if (m.getReturnType() == null || "void".equalsIgnoreCase(m.getReturnType())) {
                    sb.append("        ").append(serviceVar).append(".").append(m.getName()).append("(id);\n");
                    sb.append("        return ResponseEntity.ok(\"Operación '").append(m.getName()).append("' completada\");\n");
                } else {
                    sb.append("        return ResponseEntity.ok(").append(serviceVar).append(".").append(m.getName()).append("(id));\n");
                }
                sb.append("    }\n\n");
            }
        }

        sb.append("}\n");

        return GeneratedFileDto.builder()
                .filename(controllerName + ".java")
                .path(packagePath + "controller/" + controllerName + ".java")
                .language("java")
                .content(sb.toString())
                .build();
    }

    private GeneratedFileDto generateDto(UmlClassDto cls, DiagramDto diagram, String basePackage, String packagePath) {
        String className = capitalize(cls.getName());
        String dtoName = className + "Dto";

        StringBuilder sb = new StringBuilder();
        sb.append("package ").append(basePackage).append(".domain.dto;\n\n");
        sb.append("import lombok.*;\n");
        sb.append("import java.time.LocalDateTime;\n");
        sb.append("import java.time.LocalDate;\n\n");
        sb.append("@Data\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\n");
        sb.append("public class ").append(dtoName).append(" {\n");

        if (cls.getAttributes() != null) {
            for (UmlAttributeDto attr : cls.getAttributes()) {
                String fieldName = uncapitalize(attr.getName());
                String javaType = mapToJavaType(attr.getType());
                sb.append("    private ").append(javaType).append(" ").append(fieldName).append(";\n");
            }
        }

        if (diagram.getRelations() != null) {
            for (UmlRelationDto rel : diagram.getRelations()) {
                if (cls.getId() != null && cls.getId().equals(rel.getTargetClassId())) {
                    UmlClassDto src = findClassById(diagram, rel.getSourceClassId());
                    if (src != null) {
                        sb.append("    private Long ").append(uncapitalize(src.getName())).append("Id;\n");
                    }
                }
            }
        }

        sb.append("}\n");

        return GeneratedFileDto.builder()
                .filename(dtoName + ".java")
                .path(packagePath + "domain/dto/" + dtoName + ".java")
                .language("java")
                .content(sb.toString())
                .build();
    }

    private UmlClassDto findClassById(DiagramDto diagram, String id) {
        if (diagram == null || diagram.getClasses() == null || id == null) return null;
        return diagram.getClasses().stream().filter(c -> id.equals(c.getId())).findFirst().orElse(null);
    }

    private GeneratedFileDto generateCorsConfig(String basePackage, String packagePath) {
        String content = "package " + basePackage + ".config;\n\n" +
                "import org.springframework.context.annotation.Configuration;\n" +
                "import org.springframework.web.servlet.config.annotation.CorsRegistry;\n" +
                "import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;\n\n" +
                "@Configuration\n" +
                "public class CorsConfig implements WebMvcConfigurer {\n" +
                "    @Override\n" +
                "    public void addCorsMappings(CorsRegistry registry) {\n" +
                "        registry.addMapping(\"/**\")\n" +
                "                .allowedOriginPatterns(\"*\")\n" +
                "                .allowedMethods(\"GET\", \"POST\", \"PUT\", \"DELETE\", \"OPTIONS\")\n" +
                "                .allowedHeaders(\"*\")\n" +
                "                .allowCredentials(true);\n" +
                "    }\n" +
                "}\n";

        return GeneratedFileDto.builder()
                .filename("CorsConfig.java")
                .path(packagePath + "config/CorsConfig.java")
                .language("java")
                .content(content)
                .build();
    }

    private GeneratedFileDto generateGlobalExceptionHandler(String basePackage, String packagePath) {
        String content = "package " + basePackage + ".exception;\n\n" +
                "import org.springframework.http.HttpStatus;\n" +
                "import org.springframework.http.ResponseEntity;\n" +
                "import org.springframework.web.bind.annotation.ExceptionHandler;\n" +
                "import org.springframework.web.bind.annotation.RestControllerAdvice;\n\n" +
                "import java.time.LocalDateTime;\n" +
                "import java.util.HashMap;\n" +
                "import java.util.Map;\n\n" +
                "@RestControllerAdvice\n" +
                "public class GlobalExceptionHandler {\n" +
                "    @ExceptionHandler(Exception.class)\n" +
                "    public ResponseEntity<Map<String, Object>> handleAll(Exception e) {\n" +
                "        Map<String, Object> body = new HashMap<>();\n" +
                "        body.put(\"timestamp\", LocalDateTime.now());\n" +
                "        body.put(\"message\", e.getMessage());\n" +
                "        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);\n" +
                "    }\n" +
                "}\n";

        return GeneratedFileDto.builder()
                .filename("GlobalExceptionHandler.java")
                .path(packagePath + "exception/GlobalExceptionHandler.java")
                .language("java")
                .content(content)
                .build();
    }

    private GeneratedFileDto generateSwaggerConfig(String basePackage, String packagePath) {
        String content = "package " + basePackage + ".config;\n\n" +
                "import io.swagger.v3.oas.models.OpenAPI;\n" +
                "import io.swagger.v3.oas.models.info.Info;\n" +
                "import org.springframework.context.annotation.Bean;\n" +
                "import org.springframework.context.annotation.Configuration;\n\n" +
                "@Configuration\n" +
                "public class SwaggerConfig {\n" +
                "    @Bean\n" +
                "    public OpenAPI customOpenAPI() {\n" +
                "        return new OpenAPI().info(new Info().title(\"ArchAI Microservice API\").version(\"1.0.0\"));\n" +
                "    }\n" +
                "}\n";

        return GeneratedFileDto.builder()
                .filename("SwaggerConfig.java")
                .path(packagePath + "config/SwaggerConfig.java")
                .language("java")
                .content(content)
                .build();
    }

    private String mapToJavaType(String type) {
        if (type == null) return "String";
        String t = type.trim().toLowerCase();
        return switch (t) {
            case "int", "integer" -> "Integer";
            case "long", "bigint" -> "Long";
            case "double", "float", "decimal", "numeric" -> "Double";
            case "bool", "boolean" -> "Boolean";
            case "date" -> "LocalDate";
            case "datetime", "timestamp", "localdatetime" -> "LocalDateTime";
            default -> "String";
        };
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return "Entity";
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    private String uncapitalize(String str) {
        if (str == null || str.isEmpty()) return "entity";
        return str.substring(0, 1).toLowerCase() + str.substring(1);
    }

    private String toSnakeCase(String str) {
        if (str == null) return "";
        return str.replaceAll("([a-z])([A-Z]+)", "$1_$2").toLowerCase();
    }

    private String toKebabCase(String str) {
        if (str == null) return "";
        return str.replaceAll("([a-z])([A-Z]+)", "$1-$2").toLowerCase();
    }
}
