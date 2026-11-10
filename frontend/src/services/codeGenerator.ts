import { ModeloDiagrama } from '../types/uml';
import { GeneratedProject, GeneratedFile } from '../types/generation';

function toSnakeCase(str: string): string {
  if (!str) return '';
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function toKebabCase(str: string): string {
  if (!str) return '';
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function uncapitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function mapJavaTypeToSql(javaType: string): string {
  switch (javaType?.trim()) {
    case 'Long': return 'BIGINT';
    case 'Integer': case 'int': return 'INTEGER';
    case 'String': return 'VARCHAR(255)';
    case 'Double': case 'double': return 'NUMERIC(14,2)';
    case 'BigDecimal': return 'NUMERIC(16,4)';
    case 'Boolean': case 'boolean': return 'BOOLEAN';
    case 'LocalDate': return 'DATE';
    case 'LocalDateTime': return 'TIMESTAMP WITH TIME ZONE';
    default: return 'VARCHAR(255)';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GENERADOR SPRING BOOT 3 (JAVA 17 + JPA 3 + CLEAN ARCHITECTURE)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSpringBootProject(diagram: ModeloDiagrama): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const basePackage = 'com.archai';
  const packagePath = 'src/main/java/com/archai/';
  const artifactId = (diagram.title || 'archai-backend').toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  // 1.0 Archivos de Configuración e Infraestructura de Producción
  files.push({
    filename: 'pom.xml',
    path: 'pom.xml',
    language: 'xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.3</version>
        <relativePath/>
    </parent>
    <groupId>com.archai</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>${diagram.title || 'ArchAI Project'}</name>
    <description>API REST Spring Boot 3 generada automáticamente por ArchAI CASE Studio conforme al diagrama UML</description>
    <properties>
        <java.version>17</java.version>
        <springdoc.version>2.3.0</springdoc.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>\${springdoc.version}</version>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
`
  });

  files.push({
    filename: 'application.properties',
    path: 'src/main/resources/application.properties',
    language: 'java',
    content: `server.port=8080
spring.application.name=${(diagram.title || 'ArchAI_App').replace(/\\s+/g, '_')}

# Conexión a Base de Datos PostgreSQL
spring.datasource.url=\${DATABASE_URL:jdbc:postgresql://localhost:5432/${toSnakeCase(diagram.title || 'archai_db')}}
spring.datasource.username=\${DATABASE_USER:postgres}
spring.datasource.password=\${DATABASE_PASSWORD:postgres}
spring.datasource.driver-class-name=org.postgresql.Driver

# Configuración Hibernate JPA
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# Documentación OpenAPI Swagger
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
`
  });

  files.push({
    filename: 'Application.java',
    path: `${packagePath}Application.java`,
    language: 'java',
    content: `package ${basePackage};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada principal para la aplicación Spring Boot generada por ArchAI.
 * Proyecto: ${diagram.title || 'ArchAI Studio'}
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`
  });

  files.push({
    filename: 'CorsConfig.java',
    path: `${packagePath}config/CorsConfig.java`,
    language: 'java',
    content: `package ${basePackage}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
`
  });

  files.push({
    filename: 'GlobalExceptionHandler.java',
    path: `${packagePath}exception/GlobalExceptionHandler.java`,
    language: 'java',
    content: `package ${basePackage}.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("error", "Bad Request");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGlobalException(Exception ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        body.put("error", "Internal Server Error");
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
`
  });

  files.push({
    filename: 'OpenApiConfig.java',
    path: `${packagePath}config/OpenApiConfig.java`,
    language: 'java',
    content: `package ${basePackage}.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("${diagram.title || 'ArchAI Microservice API'}")
                        .version("1.0.0")
                        .description("Documentación OpenAPI generada por ArchAI CASE Studio según estándar UML 2.5.")
                        .contact(new Contact().name("ArchAI Studio").url("https://archai.dev")));
    }
}
`
  });

  // 1.1 Para cada clase del diagrama UML: Generar Entity, Repository, Service, Controller y DTO
  diagram.classes.forEach(cls => {
    const className = capitalize(cls.name);
    const tableName = toSnakeCase(className) + 's';
    const varName = uncapitalize(className);
    const endpoint = toKebabCase(className) + 's';

    if (cls.stereotype === 'Note') {
      return;
    }

    if (cls.stereotype === 'Enum') {
      const enumLiterals = (cls.attributes || []).map(a => a.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')).join(',\n    ');
      files.push({
        filename: `${className}.java`,
        path: `${packagePath}domain/enums/${className}.java`,
        language: 'java',
        content: `package ${basePackage}.domain.enums;

/**
 * Enumeración UML 2.5: ${className}
 */
public enum ${className} {
    ${enumLiterals || 'VALOR_DEFECTO'};
}
`
      });
      return;
    }

    if (cls.stereotype === 'Interface' || cls.isInterface) {
      let ifaceMethods = '';
      (cls.methods || []).forEach(m => {
        ifaceMethods += `    ${m.returnType || 'void'} ${m.name}(${m.parameters || ''});\n\n`;
      });
      files.push({
        filename: `${className}.java`,
        path: `${packagePath}service/${className}.java`,
        language: 'java',
        content: `package ${basePackage}.service;

/**
 * Interfaz UML 2.5: ${className}
 * Define el contrato abstracto de operaciones de software.
 */
public interface ${className} {
${ifaceMethods}
}
`
      });
      return;
    }

    const outgoingRelations = (diagram.relations || []).filter(r => r.sourceClassId === cls.id);
    const incomingRelations = (diagram.relations || []).filter(r => r.targetClassId === cls.id);

    // ─── 1.1 Entidad JPA ───
    let entityContent = `package ${basePackage}.domain.entity;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.ArrayList;

/**
 * Entidad JPA generada automáticamente por ArchAI CASE Studio.
 * Mapeo UML 2.5: Clase "${className}".
 */
@Entity
@Table(name = "${tableName}")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ${className} {

`;

    let hasId = false;
    (cls.attributes || []).forEach(attr => {
      const fieldName = uncapitalize(attr.name);
      if (attr.isPrimaryKey || fieldName.toLowerCase() === 'id') {
        hasId = true;
        entityContent += `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    @Column(name = "id")\n    private Long id;\n\n`;
      } else {
        const colName = toSnakeCase(fieldName);
        const isNullable = attr.isNullable !== false;
        entityContent += `    @Column(name = "${colName}", nullable = ${isNullable})\n    private ${attr.type} ${fieldName};\n\n`;
      }
    });

    if (!hasId) {
      entityContent += `    @Id\n    @GeneratedValue(strategy = GenerationType.IDENTITY)\n    @Column(name = "id")\n    private Long id;\n\n`;
    }

    // Relaciones Salientes (1:N hacia clases destino)
    outgoingRelations.forEach(rel => {
      const targetCls = diagram.classes.find(c => c.id === rel.targetClassId);
      if (targetCls) {
        const targetClass = capitalize(targetCls.name);
        const targetVar = uncapitalize(targetClass);
        entityContent += `    // Relación UML: ${rel.type || '1:N'} hacia ${targetClass}\n`;
        entityContent += `    @OneToMany(mappedBy = "${varName}", cascade = CascadeType.ALL, orphanRemoval = true)\n`;
        entityContent += `    @Builder.Default\n`;
        entityContent += `    private List<${targetClass}> ${targetVar}List = new ArrayList<>();\n\n`;
      }
    });

    // Relaciones Entrantes (N:1 desde clases origen)
    incomingRelations.forEach(rel => {
      const sourceCls = diagram.classes.find(c => c.id === rel.sourceClassId);
      if (sourceCls) {
        const sourceClass = capitalize(sourceCls.name);
        const sourceVar = uncapitalize(sourceClass);
        const fkCol = toSnakeCase(sourceClass) + '_id';
        entityContent += `    // Relación UML: Referencia ${rel.type || 'N:1'} desde ${sourceClass}\n`;
        entityContent += `    @ManyToOne(fetch = FetchType.LAZY)\n`;
        entityContent += `    @JoinColumn(name = "${fkCol}")\n`;
        entityContent += `    private ${sourceClass} ${sourceVar};\n\n`;
      }
    });

    // Métodos de Negocio definidos en el diagrama UML
    if (cls.methods && cls.methods.length > 0) {
      entityContent += `    // ========================================================\n`;
      entityContent += `    // MÉTODOS DE NEGOCIO UML DECLARADOS EN EL DIAGRAMA\n`;
      entityContent += `    // ========================================================\n\n`;

      cls.methods.forEach(m => {
        const retType = m.returnType && m.returnType !== 'void' ? m.returnType : 'void';
        const params = m.parameters || '';
        const visibility = m.visibility === '-' ? 'private' : m.visibility === '#' ? 'protected' : 'public';
        
        entityContent += `    /**\n     * Operación UML: ${m.name}\n     */\n`;
        entityContent += `    ${visibility} ${retType} ${m.name}(${params}) {\n`;
        if (retType === 'void') {
          entityContent += `        // TODO: Implementar lógica de negocio para ${m.name}\n`;
        } else if (retType === 'Boolean' || retType === 'boolean') {
          entityContent += `        return true;\n`;
        } else if (retType === 'Double' || retType === 'BigDecimal' || retType === 'Integer' || retType === 'Long') {
          entityContent += `        return null;\n`;
        } else if (retType === 'String') {
          entityContent += `        return "${m.name} ejecutado con éxito";\n`;
        } else {
          entityContent += `        return null;\n`;
        }
        entityContent += `    }\n\n`;
      });
    }

    entityContent += `}\n`;

    files.push({
      filename: `${className}.java`,
      path: `${packagePath}domain/entity/${className}.java`,
      language: 'java',
      content: entityContent
    });

    // ─── 1.2 Repositorio Spring Data JPA ───
    let repoContent = `package ${basePackage}.repository;

import ${basePackage}.domain.entity.${className};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para la entidad ${className}.
 */
@Repository
public interface ${className}Repository extends JpaRepository<${className}, Long> {
`;

    // Consultas derivadas según relaciones entrantes
    incomingRelations.forEach(rel => {
      const sourceCls = diagram.classes.find(c => c.id === rel.sourceClassId);
      if (sourceCls) {
        const sourceClass = capitalize(sourceCls.name);
        repoContent += `    List<${className}> findBy${sourceClass}_Id(Long ${uncapitalize(sourceClass)}Id);\n`;
      }
    });

    repoContent += `}\n`;

    files.push({
      filename: `${className}Repository.java`,
      path: `${packagePath}repository/${className}Repository.java`,
      language: 'java',
      content: repoContent
    });

    // ─── 1.3 Servicio de Lógica de Negocio ───
    let serviceContent = `package ${basePackage}.service;

import ${basePackage}.domain.entity.${className};
import ${basePackage}.repository.${className}Repository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Capa de Servicio para ${className}.
 * Orquesta la lógica de negocio y transacciones de base de datos.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ${className}Service {

    private final ${className}Repository repository;

    @Transactional(readOnly = true)
    public List<${className}> findAll() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<${className}> findById(Long id) {
        return repository.findById(id);
    }

    public ${className} save(${className} entity) {
        return repository.save(entity);
    }

    public ${className} update(Long id, ${className} updatedEntity) {
        return repository.findById(id)
                .map(existing -> {
                    updatedEntity.setId(id);
                    return repository.save(updatedEntity);
                })
                .orElseThrow(() -> new IllegalArgumentException("${className} no encontrado con ID: " + id));
    }

    public void deleteById(Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("${className} no existe con ID: " + id);
        }
        repository.deleteById(id);
    }
`;

    // Implementación en el Servicio de los métodos UML del diagrama
    if (cls.methods && cls.methods.length > 0) {
      serviceContent += `\n    // ========================================================\n`;
      serviceContent += `    // OPERACIONES DE NEGOCIO DERIVADAS DEL DIAGRAMA UML\n`;
      serviceContent += `    // ========================================================\n\n`;

      cls.methods.forEach(m => {
        const retType = m.returnType && m.returnType !== 'void' ? m.returnType : 'void';
        const params = m.parameters || '';
        const paramNames = params ? params.split(',').map(p => p.trim().split(' ').pop()).join(', ') : '';

        serviceContent += `    public ${retType} ${m.name}(Long id${params ? ', ' + params : ''}) {\n`;
        serviceContent += `        ${className} entity = repository.findById(id)\n`;
        serviceContent += `                .orElseThrow(() -> new IllegalArgumentException("${className} con ID " + id + " no encontrado"));\n`;
        
        if (retType === 'void') {
          serviceContent += `        entity.${m.name}(${paramNames});\n`;
          serviceContent += `        repository.save(entity);\n`;
        } else {
          serviceContent += `        ${retType} result = entity.${m.name}(${paramNames});\n`;
          serviceContent += `        repository.save(entity);\n`;
          serviceContent += `        return result;\n`;
        }
        serviceContent += `    }\n\n`;
      });
    }

    serviceContent += `}\n`;

    files.push({
      filename: `${className}Service.java`,
      path: `${packagePath}service/${className}Service.java`,
      language: 'java',
      content: serviceContent
    });

    // ─── 1.4 Controlador REST API ───
    let controllerContent = `package ${basePackage}.controller;

import ${basePackage}.domain.entity.${className};
import ${basePackage}.service.${className}Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Endpoints RESTful para la gestión de ${className}.
 */
@RestController
@RequestMapping("/api/v1/${endpoint}")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*")
public class ${className}Controller {

    private final ${className}Service service;

    @GetMapping
    public ResponseEntity<List<${className}>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<${className}> getById(@PathVariable Long id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<${className}> create(@RequestBody ${className} entity) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.save(entity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<${className}> update(@PathVariable Long id, @RequestBody ${className} entity) {
        return ResponseEntity.ok(service.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }
`;

    // Endpoints REST adicionales para métodos UML
    if (cls.methods && cls.methods.length > 0) {
      controllerContent += `\n    // ========================================================\n`;
      controllerContent += `    // ENDPOINTS DE ACCIONES DE NEGOCIO UML\n`;
      controllerContent += `    // ========================================================\n\n`;

      cls.methods.forEach(m => {
        const actionPath = toKebabCase(m.name);
        controllerContent += `    @PostMapping("/{id}/${actionPath}")\n`;
        controllerContent += `    public ResponseEntity<?> execute${capitalize(m.name)}(@PathVariable Long id) {\n`;
        if (!m.returnType || m.returnType === 'void') {
          controllerContent += `        service.${m.name}(id);\n`;
          controllerContent += `        return ResponseEntity.ok("Operación '${m.name}' ejecutada con éxito");\n`;
        } else {
          controllerContent += `        return ResponseEntity.ok(service.${m.name}(id));\n`;
        }
        controllerContent += `    }\n\n`;
      });
    }

    controllerContent += `}\n`;

    files.push({
      filename: `${className}Controller.java`,
      path: `${packagePath}controller/${className}Controller.java`,
      language: 'java',
      content: controllerContent
    });

    // ─── 1.5 DTO (Data Transfer Object) ───
    let dtoContent = `package ${basePackage}.domain.dto;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;

/**
 * Data Transfer Object para ${className}.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ${className}Dto {

`;
    (cls.attributes || []).forEach(attr => {
      const fieldName = uncapitalize(attr.name);
      dtoContent += `    private ${attr.type} ${fieldName};\n`;
    });

    // Relaciones en el DTO
    incomingRelations.forEach(rel => {
      const sourceCls = diagram.classes.find(c => c.id === rel.sourceClassId);
      if (sourceCls) {
        dtoContent += `    private Long ${uncapitalize(sourceCls.name)}Id;\n`;
      }
    });

    dtoContent += `}\n`;

    files.push({
      filename: `${className}Dto.java`,
      path: `${packagePath}domain/dto/${className}Dto.java`,
      language: 'java',
      content: dtoContent
    });
  });

  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERADOR POSTGRESQL DDL (.sql) CON CLAVES FORÁNEAS E ÍNDICES
// ─────────────────────────────────────────────────────────────────────────────

export function generatePostgreSqlDdl(diagram: ModeloDiagrama): string {
  let ddl = `-- ========================================================\n`;
  ddl += `-- ARCHAI CASE ENGINE - POSTGRESQL DDL GENERATOR\n`;
  ddl += `-- Diagrama: ${diagram.title || 'UML Model'}\n`;
  ddl += `-- Clases UML: ${diagram.classes?.length || 0} | Relaciones: ${diagram.relations?.length || 0}\n`;
  ddl += `-- Fecha de Generación: ${new Date().toISOString()}\n`;
  ddl += `-- ========================================================\n\n`;

  (diagram.classes || []).forEach(cls => {
    if (cls.stereotype === 'Note' || cls.stereotype === 'Interface') {
      return;
    }

    if (cls.stereotype === 'Enum') {
      const enumValues = (cls.attributes || []).map(a => `'${a.name.toUpperCase()}'`).join(', ');
      ddl += `-- Tipo Enumerado UML 2.5: ${cls.name}\n`;
      ddl += `DO $$ BEGIN\n    CREATE TYPE enum_${toSnakeCase(cls.name)} AS ENUM (${enumValues || "'ACTIVO'"});\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;\n\n`;
      return;
    }

    const tableName = toSnakeCase(cls.name) + 's';
    ddl += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
    
    const lines: string[] = [];
    let hasId = false;

    (cls.attributes || []).forEach(attr => {
      const colName = toSnakeCase(attr.name);
      if (attr.isPrimaryKey || colName.toLowerCase() === 'id') {
        hasId = true;
        lines.push(`    id BIGSERIAL PRIMARY KEY`);
      } else {
        const sqlType = mapJavaTypeToSql(attr.type);
        const nullability = attr.isNullable === false ? ' NOT NULL' : '';
        lines.push(`    ${colName} ${sqlType}${nullability}`);
      }
    });

    if (!hasId) {
      lines.unshift(`    id BIGSERIAL PRIMARY KEY`);
    }

    // Claves foráneas derivadas de relaciones entrantes
    const incomingRelations = (diagram.relations || []).filter(r => r.targetClassId === cls.id);
    incomingRelations.forEach(rel => {
      const src = diagram.classes.find(c => c.id === rel.sourceClassId);
      if (src) {
        const srcCol = toSnakeCase(src.name) + '_id';
        const srcTable = toSnakeCase(src.name) + 's';
        lines.push(`    ${srcCol} BIGINT REFERENCES ${srcTable}(id) ON DELETE CASCADE`);
      }
    });

    ddl += lines.join(',\n') + '\n);\n\n';

    // Índices de optimización para claves foráneas
    incomingRelations.forEach(rel => {
      const src = diagram.classes.find(c => c.id === rel.sourceClassId);
      if (src) {
        const idxName = `idx_${tableName}_${toSnakeCase(src.name)}_id`;
        const srcCol = toSnakeCase(src.name) + '_id';
        ddl += `CREATE INDEX IF NOT EXISTS ${idxName} ON ${tableName} (${srcCol});\n`;
      }
    });

    if (incomingRelations.length > 0) ddl += '\n';
  });

  return ddl;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GENERADOR COLECCIÓN POSTMAN (JSON v2.1) CON ACCIONES DE NEGOCIO
// ─────────────────────────────────────────────────────────────────────────────

export function generatePostmanCollection(diagram: ModeloDiagrama): string {
  const items = (diagram.classes || []).map(cls => {
    const resource = toKebabCase(cls.name) + 's';
    const sampleBody: Record<string, any> = {};

    (cls.attributes || []).forEach(a => {
      if (!a.isPrimaryKey && a.name.toLowerCase() !== 'id') {
        if (a.type === 'String') sampleBody[a.name] = `Ejemplo ${a.name}`;
        else if (a.type === 'Long' || a.type === 'Integer') sampleBody[a.name] = 100;
        else if (a.type === 'Double' || a.type === 'BigDecimal') sampleBody[a.name] = 49.99;
        else if (a.type === 'Boolean') sampleBody[a.name] = true;
        else if (a.type === 'LocalDate') sampleBody[a.name] = '2026-09-22';
        else sampleBody[a.name] = 'valor';
      }
    });

    const requests: any[] = [
      {
        name: `Listar todos (${cls.name})`,
        request: {
          method: 'GET',
          header: [],
          url: {
            raw: `http://localhost:8080/api/v1/${resource}`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource]
          }
        }
      },
      {
        name: `Crear nuevo (${cls.name})`,
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(sampleBody, null, 2)
          },
          url: {
            raw: `http://localhost:8080/api/v1/${resource}`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource]
          }
        }
      },
      {
        name: `Obtener por ID (${cls.name})`,
        request: {
          method: 'GET',
          header: [],
          url: {
            raw: `http://localhost:8080/api/v1/${resource}/1`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource, '1']
          }
        }
      },
      {
        name: `Actualizar (${cls.name})`,
        request: {
          method: 'PUT',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: {
            mode: 'raw',
            raw: JSON.stringify(sampleBody, null, 2)
          },
          url: {
            raw: `http://localhost:8080/api/v1/${resource}/1`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource, '1']
          }
        }
      },
      {
        name: `Eliminar (${cls.name})`,
        request: {
          method: 'DELETE',
          header: [],
          url: {
            raw: `http://localhost:8080/api/v1/${resource}/1`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource, '1']
          }
        }
      }
    ];

    // Endpoints Postman para métodos de negocio UML
    (cls.methods || []).forEach(m => {
      requests.push({
        name: `Ejecutar: ${m.name} (${cls.name})`,
        request: {
          method: 'POST',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          url: {
            raw: `http://localhost:8080/api/v1/${resource}/1/${toKebabCase(m.name)}`,
            protocol: 'http',
            host: ['localhost'],
            port: '8080',
            path: ['api', 'v1', resource, '1', toKebabCase(m.name)]
          }
        }
      });
    });

    return {
      name: cls.name,
      item: requests
    };
  });

  const collection = {
    info: {
      name: `ArchAI API - ${diagram.title || 'Microservice'}`,
      description: 'Colección de pruebas REST generada automáticamente por ArchAI CASE Studio según estándar UML 2.5.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: items
  };

  return JSON.stringify(collection, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GENERADOR XMI (XML Metadata Interchange v2.1 para Architec / Enterprise Architect)
// ─────────────────────────────────────────────────────────────────────────────

export function generateXmiXml(diagram: ModeloDiagrama): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<xmi:XMI xmi:version="2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1" xmlns:uml="http://www.eclipse.org/uml2/3.0.0/UML">\n`;
  xml += `  <uml:Model xmi:id="model_archai" name="${diagram.title || 'ArchAI_Model'}">\n`;
  
  (diagram.classes || []).forEach(cls => {
    xml += `    <packagedElement xmi:type="uml:Class" xmi:id="${cls.id}" name="${cls.name}">\n`;
    (cls.attributes || []).forEach(attr => {
      xml += `      <ownedAttribute xmi:type="uml:Property" xmi:id="${attr.id}" name="${attr.name}" visibility="${attr.visibility === '+' ? 'public' : 'private'}" type="${attr.type}" />\n`;
    });
    (cls.methods || []).forEach(m => {
      xml += `      <ownedOperation xmi:type="uml:Operation" xmi:id="${m.id}" name="${m.name}" visibility="${m.visibility === '+' ? 'public' : 'private'}">\n`;
      if (m.returnType && m.returnType !== 'void') {
        xml += `        <ownedParameter xmi:type="uml:Parameter" direction="return" type="${m.returnType}" />\n`;
      }
      if (m.parameters) {
        xml += `        <ownedParameter xmi:type="uml:Parameter" name="${m.parameters}" />\n`;
      }
      xml += `      </ownedOperation>\n`;
    });
    xml += `    </packagedElement>\n`;
  });

  (diagram.relations || []).forEach(rel => {
    xml += `    <packagedElement xmi:type="uml:Association" xmi:id="${rel.id}" name="${rel.label || 'association'}">\n`;
    xml += `      <memberEnd xmi:idref="${rel.sourceClassId}" />\n`;
    xml += `      <memberEnd xmi:idref="${rel.targetClassId}" />\n`;
    xml += `    </packagedElement>\n`;
  });

  xml += `  </uml:Model>\n`;
  xml += `</xmi:XMI>`;

  return xml;
}

export function buildGeneratedProject(diagram: ModeloDiagrama): GeneratedProject {
  const javaFiles = generateSpringBootProject(diagram);
  const ddlSql = generatePostgreSqlDdl(diagram);
  const postmanJson = generatePostmanCollection(diagram);
  const xmiXml = generateXmiXml(diagram);

  return {
    projectName: (diagram.title || 'archai-backend').toLowerCase().replace(/\\s+/g, '-'),
    files: javaFiles,
    ddlSql,
    postmanJson,
    xmiXml
  };
}
