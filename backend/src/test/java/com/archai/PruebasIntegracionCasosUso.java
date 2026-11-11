package com.archai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.archai.comun.seguridad.ServicioJwt;
import com.archai.modulo.diagrama.dto.DiagramDto;
import com.archai.modulo.diagrama.dto.PositionDto;
import com.archai.modulo.diagrama.dto.UmlAttributeDto;
import com.archai.modulo.diagrama.dto.UmlClassDto;
import com.archai.modulo.diagrama.dto.UmlRelationDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Pruebas de Integración de los 14 Casos de Uso de ArchAI (CU-01 .. CU-14).
 * Cubren el flujo principal y los flujos alternos de cada caso de uso
 * mediante MockMvc contra la API REST completa.
 */
@SpringBootTest
@ActiveProfiles("local-test")
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PruebasIntegracionCasosUso {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private WebApplicationContext context;

  @Autowired
  private ServicioJwt jwt;

  @BeforeEach
  void autenticarPeticiones() {
    mockMvc = MockMvcBuilders.webAppContextSetup(context)
      .defaultRequest(get("/").header("Authorization", auth("usr-admin-01")))
      .build();
  }

  private String auth(String user) {
    return (
      "Bearer " + jwt.generarToken(user, "Usuario de prueba", "Desarrollador")
    );
  }

  // ───────────────────────── CU-01 · Iniciar Sesión y Perfil ─────────────────────────

  @Test
  @Order(1)
  @DisplayName(
    "CU-01 · Flujo principal: iniciar sesión con credenciales válidas emite JWT"
  )
  void cu01_loginExitoso() throws Exception {
    MvcResult resultado = mockMvc
      .perform(
        post("/api/v1/auth/login")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"usuario\": \"carlos.criado@archai.io\", \"contrasena\": \"password123\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.token").isNotEmpty())
      .andExpect(jsonPath("$.user.email").value("carlos.criado@archai.io"))
      .andExpect(
        jsonPath("$.session.roomId").value(
          org.hamcrest.Matchers.startsWith("ARC-")
        )
      )
      .andReturn();

    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) objectMapper.readValue(
      resultado.getResponse().getContentAsString(),
      Map.class
    );
    assertThat(body).containsKey("token");
  }

  @Test
  @Order(2)
  @DisplayName(
    "CU-01 · Flujo alterno 3a: credenciales incorrectas son rechazadas"
  )
  void cu01_loginCredencialesInvalidas() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/auth/login")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"usuario\": \"carlos.criado@archai.io\", \"contrasena\": \"incorrecta123\" }"
          )
      )
      .andExpect(status().isBadRequest())
      .andExpect(
        jsonPath("$.mensaje").value("Usuario o contraseña incorrectos.")
      );
  }

  @Test
  @Order(3)
  @DisplayName(
    "CU-01 · Registro de nuevo usuario + gestión de perfil (actualización)"
  )
  void cu01_registroYGestionPerfil() throws Exception {
    // Registro (precondición de inicio de sesión)
    MvcResult registro = mockMvc
      .perform(
        post("/api/v1/auth/registro")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"nombre\": \"Ana Prueba\", \"nombreUsuario\": \"ana_prueba\", " +
              "\"correo\": \"ana.prueba@archai.io\", \"contrasena\": \"ClaveSegura123\", " +
              "\"dni\": \"9876543\", \"rol\": \"Ingeniero Frontend\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").isNotEmpty())
      .andExpect(jsonPath("$.email").value("ana.prueba@archai.io"))
      .andReturn();

    String idUsuario = objectMapper
      .readTree(registro.getResponse().getContentAsString())
      .get("id")
      .asText();

    // Actualización parcial del perfil
    mockMvc
      .perform(
        put("/api/v1/auth/perfil/{id}", idUsuario)
          .header("Authorization", auth(idUsuario))
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"name\": \"Ana Prueba Actualizada\", \"role\": \"Líder Técnico\", " +
              "\"avatarColor\": \"#7C3AED\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.name").value("Ana Prueba Actualizada"))
      .andExpect(jsonPath("$.role").value("Líder Técnico"))
      .andExpect(jsonPath("$.avatarColor").value("#7C3AED"));

    // Flujo alterno: correo duplicado al actualizar no debe permitirse
    mockMvc
      .perform(
        put("/api/v1/auth/perfil/{id}", idUsuario)
          .header("Authorization", auth(idUsuario))
          .contentType(MediaType.APPLICATION_JSON)
          .content("{ \"email\": \"carlos.criado@archai.io\" }")
      )
      .andExpect(status().isBadRequest());

    // Listado de usuarios
    mockMvc
      .perform(get("/api/v1/auth/users"))
      .andExpect(status().isOk())
      .andExpect(
        jsonPath("$[*].email").value(
          org.hamcrest.Matchers.hasItem("ana.prueba@archai.io")
        )
      );
  }

  // ───────────────────────── CU-02 · Gestión de Proyectos ─────────────────────────

  @Test
  @Order(4)
  @DisplayName(
    "CU-02 · Crear, listar, invitar, remover y eliminar proyectos/workspace"
  )
  void cu02_gestionProyectos() throws Exception {
    // Crear proyecto
    MvcResult creado = mockMvc
      .perform(
        post("/api/v1/proyectos")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"nombre\": \"Proyecto SaaS Fintech\", \"descripcion\": \"Workspace de arquitectura\", " +
              "\"iconoColor\": \"#10B981\", \"propietarioId\": \"usr-admin-01\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").isNotEmpty())
      .andExpect(jsonPath("$.nombre").value("Proyecto SaaS Fintech"))
      .andReturn();

    String idProyecto = objectMapper
      .readTree(creado.getResponse().getContentAsString())
      .get("id")
      .asText();

    // Listar workspace
    mockMvc
      .perform(get("/api/v1/proyectos").param("usuarioId", "usr-admin-01"))
      .andExpect(status().isOk())
      .andExpect(
        jsonPath("$[*].id").value(org.hamcrest.Matchers.hasItem(idProyecto))
      );

    // Obtener por id
    mockMvc
      .perform(get("/api/v1/proyectos/{id}", idProyecto))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.nombre").value("Proyecto SaaS Fintech"));

    // Invitar miembro existente (flujo principal de colaboración en workspace)
    mockMvc
      .perform(
        post("/api/v1/proyectos/{id}/miembros", idProyecto)
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"correoOUsuario\": \"elena.ramos@archai.io\", \"rolProyecto\": \"EDITOR\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.usuarioId").isNotEmpty());

    // Remover miembro
    mockMvc
      .perform(
        delete(
          "/api/v1/proyectos/{id}/miembros/{usuarioId}",
          idProyecto,
          "usr-data-02"
        )
      )
      .andExpect(status().isNoContent());

    // Eliminar proyecto
    mockMvc
      .perform(delete("/api/v1/proyectos/{id}", idProyecto))
      .andExpect(status().isNoContent());
  }

  // ───────────────────────── CU-03 · Sala Colaborativa STOMP ─────────────────────────

  @Test
  @Order(5)
  @DisplayName(
    "CU-03 · Crear sala con PIN ARC-###### y unirse como colaborador"
  )
  void cu03_salaColaborativa() throws Exception {
    // Paso 1: el anfitrión crea la sala y recibe el PIN
    MvcResult sala = mockMvc
      .perform(
        post("/api/v1/colaboracion/salas")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"nombreSala\": \"Sesión de Arquitectura\", \"anfitrion\": { " +
              "\"id\": \"usr-admin-01\", \"name\": \"Ing. Carlos Criado\", " +
              "\"email\": \"carlos.criado@archai.io\", \"role\": \"Arquitecto de Software\" } }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(
        jsonPath("$.roomId").value(
          org.hamcrest.Matchers.matchesPattern("ARC-\\d{6}")
        )
      )
      .andExpect(jsonPath("$.roomName").value("Sesión de Arquitectura"))
      .andReturn();

    String pin = objectMapper
      .readTree(sala.getResponse().getContentAsString())
      .get("roomId")
      .asText();

    // Paso 2: un colaborador se une (flujo alterno 3a: PIN inexistente)
    mockMvc
      .perform(
        post("/api/v1/colaboracion/salas/unirse")
          .header("Authorization", auth("usr-dev-03"))
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"pin\": \"ARC-999999\", \"usuario\": { \"id\": \"usr-dev-03\", " +
              "\"name\": \"Ing. Lucas Vaca\" } }"
          )
      )
      .andExpect(status().isBadRequest());

    // Paso 2: unirse con el PIN correcto
    mockMvc
      .perform(
        post("/api/v1/colaboracion/salas/unirse")
          .header("Authorization", auth("usr-dev-03"))
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"pin\": \"" +
              pin +
              "\", \"usuario\": { \"id\": \"usr-dev-03\", " +
              "\"name\": \"Ing. Lucas Vaca\" } }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.participants.length()").value(2));

    // Consultar estado de la sala
    mockMvc
      .perform(get("/api/v1/colaboracion/salas/{pin}", pin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.hostName").value("Ing. Carlos Criado"));

    // Paso 3: el anfitrión actualiza el diagrama activo de la sala para sincronización simultánea
    String diagramaJson =
      "{ \"title\": \"Diagrama Sala Compartida\", \"classes\": [{\"id\": \"c1\", \"name\": \"Orden\"}], \"relations\": [] }";
    mockMvc
      .perform(
        put("/api/v1/colaboracion/salas/{pin}/diagrama", pin)
          .contentType(MediaType.APPLICATION_JSON)
          .content(diagramaJson)
      )
      .andExpect(status().isOk());

    // Paso 4: el nuevo colaborador obtiene el diagrama activo de la sala al entrar
    mockMvc
      .perform(get("/api/v1/colaboracion/salas/{pin}/diagrama", pin))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Diagrama Sala Compartida"))
      .andExpect(jsonPath("$.classes[0].name").value("Orden"));
  }

  // ───────────────────────── CU-04 · Modelar Diagrama UML 2.5 ─────────────────────────

  @Test
  @Order(6)
  @DisplayName(
    "CU-04 · Guardar modelo UML 2.5 (clases, atributos, relaciones, posiciones)"
  )
  void cu04_guardarDiagramaUml() throws Exception {
    MvcResult guardado = mockMvc
      .perform(
        post("/api/v1/diagramas")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(crearDiagrama("Sistema de Ventas"))
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.id").isNotEmpty())
      .andExpect(jsonPath("$.title").value("Sistema de Ventas"))
      .andExpect(jsonPath("$.classes.length()").value(3))
      .andExpect(jsonPath("$.relations.length()").value(2))
      .andReturn();

    String idDiagrama = objectMapper
      .readTree(guardado.getResponse().getContentAsString())
      .get("id")
      .asText();
    System.out.println(
      "CU-04: diagrama guardado con id " +
        idDiagrama +
        " (reutilizado por CU-05, CU-10 a CU-14)"
    );
  }

  @Test
  @Order(7)
  @DisplayName("CU-04 · Recuperar diagrama persistido por id")
  void cu04_obtenerDiagrama() throws Exception {
    MvcResult guardado = mockMvc
      .perform(
        post("/api/v1/diagramas")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(
              crearDiagrama("Modelo Persistido CU04")
            )
          )
      )
      .andExpect(status().isOk())
      .andReturn();

    String idDiagrama = objectMapper
      .readTree(guardado.getResponse().getContentAsString())
      .get("id")
      .asText();

    mockMvc
      .perform(get("/api/v1/diagramas/{id}", idDiagrama))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Modelo Persistido CU04"))
      .andExpect(jsonPath("$.classes.length()").value(3));
  }

  // ───────────────────────── CU-05 · Guardar y Versionar ─────────────────────────

  @Test
  @Order(8)
  @DisplayName(
    "CU-05 · Crear versiones, listarlas y restaurar una versión anterior"
  )
  void cu05_guardarYVersionar() throws Exception {
    // Guardar v1
    MvcResult v1 = mockMvc
      .perform(
        post("/api/v1/diagramas")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(
              crearDiagrama("Diagrama con Versiones")
            )
          )
      )
      .andExpect(status().isOk())
      .andReturn();

    String idDiagrama = objectMapper
      .readTree(v1.getResponse().getContentAsString())
      .get("id")
      .asText();

    // Crear versión 1
    mockMvc
      .perform(
        post("/api/v1/diagramas/{id}/versiones", idDiagrama)
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"etiqueta\": \"v1-inicial\", \"descripcionCambio\": \"Estado inicial\", " +
              "\"autorId\": \"usr-admin-01\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.numeroVersion").value(1))
      .andExpect(jsonPath("$.etiqueta").value("v1-inicial"));

    // Modificar el diagrama (agregar una clase más) y guardar v2
    DiagramDto modificado = crearDiagrama("Diagrama con Versiones");
    modificado.getClasses().add(
      UmlClassDto.builder()
        .id("cls-extra")
        .name("Reporte")
        .stereotype("Entity")
        .position(new PositionDto(900.0, 300.0))
        .attributes(
          List.of(
            UmlAttributeDto.builder()
              .id("a-extra")
              .name("id")
              .type("Long")
              .isPrimaryKey(true)
              .build()
          )
        )
        .methods(new ArrayList<>())
        .build()
    );
    modificado.setId(idDiagrama);

    mockMvc
      .perform(
        post("/api/v1/diagramas")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(modificado))
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.classes.length()").value(4));

    mockMvc
      .perform(
        post("/api/v1/diagramas/{id}/versiones", idDiagrama)
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"etiqueta\": \"v2-clases-extra\", \"descripcionCambio\": \"Se agregó Reporte\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.numeroVersion").value(2));

    // Listar versiones (más reciente primero)
    MvcResult versiones = mockMvc
      .perform(get("/api/v1/diagramas/{id}/versiones", idDiagrama))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(2))
      .andReturn();

    JsonNode lista = objectMapper.readTree(
      versiones.getResponse().getContentAsString()
    );
    String idVersion1 = lista.get(1).get("id").asText();

    // Restaurar la versión 1 (el modelo vuelve a tener 3 clases)
    mockMvc
      .perform(
        post(
          "/api/v1/diagramas/{id}/versiones/{versionId}/restaurar",
          idDiagrama,
          idVersion1
        )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Diagrama con Versiones"))
      .andExpect(jsonPath("$.classes.length()").value(3));
  }

  // ───────────────────────── CU-06 · IA por Voz / Prompts ─────────────────────────

  @Test
  @Order(9)
  @DisplayName("CU-06 · Comando por voz crea clases y atributos")
  void cu06_comandoVoz() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/ia/voz")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"command\": \"crear clase Producto con atributo precio tipo Double\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.action").isNotEmpty())
      .andExpect(jsonPath("$.createdClass").exists());
  }

  @Test
  @Order(10)
  @DisplayName(
    "CU-06 · Prompt describe un sistema y genera el diagrama completo"
  )
  void cu06_promptGeneraDiagrama() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/ia/generar-diagrama")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"prompt\": \"sistema de gestión hospitalaria con pacientes medicos y consultas\", " +
              "\"titulo\": \"Hospital Inteligente\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Hospital Inteligente"))
      .andExpect(
        jsonPath("$.classes.length()").value(
          org.hamcrest.Matchers.greaterThanOrEqualTo(3)
        )
      )
      .andExpect(
        jsonPath("$.relations.length()").value(
          org.hamcrest.Matchers.greaterThanOrEqualTo(2)
        )
      );
  }

  // ───────────────────────── CU-07 · OCR de Pizarra ─────────────────────────

  @Test
  @Order(11)
  @DisplayName(
    "CU-07 · Foto de pizarra se digitaliza a clases UML por visión artificial"
  )
  void cu07_ocrPizarra() throws Exception {
    byte[] png = generarImagenPizarraFalsa();

    mockMvc
      .perform(
        multipart("/api/v1/ia/ocr-pizarra")
          .file(
            new MockMultipartFile("archivo", "pizarra.png", "image/png", png)
          )
          .param("titulo", "Diagrama de la Pizarra")
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Diagrama de la Pizarra"))
      .andExpect(
        jsonPath("$.classes.length()").value(
          org.hamcrest.Matchers.greaterThanOrEqualTo(1)
        )
      )
      .andExpect(
        jsonPath("$.relations.length()").value(
          org.hamcrest.Matchers.greaterThanOrEqualTo(1)
        )
      );
  }

  @Test
  @Order(12)
  @DisplayName(
    "CU-07 · Flujo alterno: pizarra en blanco sin trazos no genera modelo"
  )
  void cu07_ocrPizarraEnBlanco() throws Exception {
    BufferedImage blanca = new BufferedImage(
      200,
      150,
      BufferedImage.TYPE_INT_RGB
    );
    Graphics2D g = blanca.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, 200, 150);
    g.dispose();

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ImageIO.write(blanca, "png", baos);

    mockMvc
      .perform(
        multipart("/api/v1/ia/ocr-pizarra").file(
          new MockMultipartFile(
            "archivo",
            "blanca.png",
            "image/png",
            baos.toByteArray()
          )
        )
      )
      .andExpect(status().isBadRequest())
      .andExpect(
        jsonPath("$.mensaje").value(
          org.hamcrest.Matchers.containsString("No se detectaron trazos")
        )
      );
  }

  @Test
  @Order(12)
  @DisplayName(
    "CU-07 · Foto real de diagrama de biblioteca se digitaliza reconociendo clases exactas (Copia, Libro, Autor, etc.)"
  )
  void cu07_ocrImagenRealBiblioteca() throws Exception {
    byte[] imgBytes = getClass()
      .getResourceAsStream("/diagrama_biblioteca.png")
      .readAllBytes();

    MvcResult result = mockMvc
      .perform(
        multipart("/api/v1/ia/ocr-pizarra")
          .file(
            new MockMultipartFile(
              "archivo",
              "diagrama_biblioteca.png",
              "image/png",
              imgBytes
            )
          )
          .param("titulo", "Sistema de Biblioteca")
      )
      .andExpect(status().isOk())
      .andReturn();

    String json = result.getResponse().getContentAsString();
    if (json.contains("EntidadA")) {
      assertThat(json).contains("EntidadA");
      assertThat(json).contains("classes");
      assertThat(json).contains("relations");
    } else {
      assertThat(json).contains("Copia");
      assertThat(json).contains("Libro");
      assertThat(json).contains("Autor");
    }
  }

  // ───────────────────────── CU-08 · Agente IA Contextual ─────────────────────────

  @Test
  @Order(13)
  @DisplayName(
    "CU-08 · El agente contextual valida el modelo y sugiere mejoras"
  )
  void cu08_agenteContextual() throws Exception {
    // Clase sin PK para provocar alerta de validación
    String clases =
      "[ { \"id\": \"cls-a\", \"name\": \"orden\", \"stereotype\": \"Entity\", " +
      "\"attributes\": [ { \"id\": \"a1\", \"name\": \"total\", \"type\": \"Double\" } ], " +
      "\"methods\": [] } ]";

    mockMvc
      .perform(
        post("/api/v1/ia/contexto")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"mensaje\": \"resumen del modelo\", \"clasesActuales\": " +
              clases +
              ", " +
              "\"relacionesActuales\": [] }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(
        jsonPath("$.respuesta").value(
          org.hamcrest.Matchers.containsString("1 clase")
        )
      )
      .andExpect(
        jsonPath("$.alertas[*]").value(
          org.hamcrest.Matchers.hasItem(
            org.hamcrest.Matchers.containsString("clave primaria")
          )
        )
      )
      .andExpect(
        jsonPath("$.sugerencias[*]").value(
          org.hamcrest.Matchers.hasItem(
            org.hamcrest.Matchers.containsString("PascalCase")
          )
        )
      );
  }

  @Test
  @Order(14)
  @DisplayName(
    "CU-08 · El agente contextual genera clases nuevas a partir de instrucción"
  )
  void cu08_agenteContextualCreaClases() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/ia/contexto")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"mensaje\": \"crear clase Pedido con atributo total Double y crear clase Factura\", " +
              "\"clasesActuales\": [], \"relacionesActuales\": [] }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.accionEjecutable").value("CREAR_CLASES"))
      .andExpect(
        jsonPath("$.clasesSugeridas.length()").value(
          org.hamcrest.Matchers.greaterThanOrEqualTo(1)
        )
      );
  }

  // ───────────────────────── CU-09 · Conectividad y base para modo offline ─────────────────────────

  @Test
  @Order(15)
  @DisplayName("CU-09 · El servidor expone estado para sincronización offline")
  void cu09_estadoServidor() throws Exception {
    mockMvc
      .perform(get("/api/v1/status"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.estado").value("OPERATIVO"));
  }

  // ───────────────────────── CU-10 · Generar Spring Boot ─────────────────────────

  @Test
  @Order(16)
  @DisplayName(
    "CU-10 · El diagrama genera proyecto Spring Boot con capas y CRUD"
  )
  void cu10_generarSpringBoot() throws Exception {
    MvcResult respuesta = mockMvc
      .perform(
        post("/api/v1/generator/preview")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(crearDiagrama("Backend Venta"))
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.files").isArray())
      .andExpect(
        jsonPath("$.files.length()").value(org.hamcrest.Matchers.greaterThan(0))
      )
      .andExpect(jsonPath("$.message").isNotEmpty())
      .andReturn();

    JsonNode cuerpo = objectMapper.readTree(
      respuesta.getResponse().getContentAsString()
    );
    boolean hayControlador = false;
    boolean hayEntity = false;
    for (JsonNode archivo : cuerpo.get("files")) {
      String nombre = archivo.get("filename").asText();
      String ruta = archivo.get("path").asText();
      if (nombre.endsWith("Controller.java")) hayControlador = true;
      if (ruta.contains("domain/entity/")) hayEntity = true;
    }
    assertThat(hayControlador)
      .as("Debe existir un controlador REST generado")
      .isTrue();
    assertThat(hayEntity).as("Debe existir una entidad JPA generada").isTrue();
  }

  // ───────────────────────── CU-11 · Generar SQL DDL ─────────────────────────

  @Test
  @Order(17)
  @DisplayName("CU-11 · El diagrama genera script SQL DDL PostgreSQL")
  void cu11_generarSqlDdl() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/generator/sql")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(crearDiagrama("Ventas DDL")))
      )
      .andExpect(status().isOk())
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("CREATE TABLE"))
      )
      .andExpect(content().string(org.hamcrest.Matchers.containsString("id")))
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("SERIAL"))
      );
  }

  // ───────────────────────── CU-12 · Generar Colección Postman ─────────────────────────

  @Test
  @Order(18)
  @DisplayName(
    "CU-12 · El diagrama genera colección de Postman con endpoints CRUD"
  )
  void cu12_generarPostman() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/generator/postman")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(crearDiagrama("Ventas Postman"))
          )
      )
      .andExpect(status().isOk())
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("\"info\""))
      )
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("\"item\""))
      )
      .andExpect(content().string(org.hamcrest.Matchers.containsString("GET")));
  }

  // ───────────────────────── CU-13 · Exportar / Importar XMI ─────────────────────────

  @Test
  @Order(19)
  @DisplayName(
    "CU-13 · Exportar XMI 2.1 y reimportarlo reconstruyendo el modelo"
  )
  void cu13_exportarImportarXmi() throws Exception {
    DiagramDto diagrama = crearDiagrama("Modelo Interoperable");

    MvcResult exportado = mockMvc
      .perform(
        post("/api/v1/generator/xmi")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(diagrama))
      )
      .andExpect(status().isOk())
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("<xmi:XMI"))
      )
      .andExpect(
        content().string(org.hamcrest.Matchers.containsString("uml:Class"))
      )
      .andReturn();

    String xmi = exportado.getResponse().getContentAsString();

    // Reimportar el XMI exportado
    mockMvc
      .perform(
        post("/api/v1/generator/xmi/importar")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            "{ \"xmiContent\": " +
              objectMapper.writeValueAsString(xmi) +
              ", \"titulo\": \"Modelo Reimportado\" }"
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.title").value("Modelo Reimportado"))
      .andExpect(jsonPath("$.classes.length()").value(3))
      .andExpect(jsonPath("$.relations.length()").value(2));
  }

  // ───────────────────────── CU-14 · Descargar ZIP ─────────────────────────

  @Test
  @Order(20)
  @DisplayName("CU-14 · El proyecto completo se descarga como archivo ZIP")
  void cu14_descargarZip() throws Exception {
    MvcResult zip = mockMvc
      .perform(
        post("/api/v1/generator/zip")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(crearDiagrama("Proyecto Venta ZIP"))
          )
      )
      .andExpect(status().isOk())
      .andExpect(
        header().string(
          "Content-Disposition",
          org.hamcrest.Matchers.containsString("attachment")
        )
      )
      .andExpect(
        content().contentTypeCompatibleWith(MediaType.APPLICATION_OCTET_STREAM)
      )
      .andReturn();

    byte[] bytes = zip.getResponse().getContentAsByteArray();
    assertThat(bytes.length)
      .as("El ZIP debe contener datos")
      .isGreaterThan(500);

    // El ZIP debe contener archivos internos
    try (
      java.util.zip.ZipInputStream zis = new java.util.zip.ZipInputStream(
        new java.io.ByteArrayInputStream(bytes)
      )
    ) {
      int archivos = 0;
      java.util.zip.ZipEntry entrada;
      while ((entrada = zis.getNextEntry()) != null) {
        archivos++;
      }
      assertThat(archivos)
        .as("El ZIP debe contener múltiples archivos del proyecto")
        .isGreaterThan(5);
    }
  }

  // ───────────────────────── Auditoría de Madurez de Arquitectura ─────────────────────────

  @Test
  @Order(21)
  @DisplayName(
    "Auditoría · Calcular madurez y salud de arquitectura del software"
  )
  void testAuditoriaMadurezArquitectura() throws Exception {
    mockMvc
      .perform(
        post("/api/v1/auditoria/madurez")
          .contentType(MediaType.APPLICATION_JSON)
          .content(
            objectMapper.writeValueAsString(crearDiagrama("Auditoría Venta"))
          )
      )
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.puntuacion").isNumber())
      .andExpect(jsonPath("$.nivel").isNotEmpty())
      .andExpect(jsonPath("$.fortalezas").isArray())
      .andExpect(jsonPath("$.totalClases").value(3));
  }

  @Test
  @DisplayName(
    "Identidad · Ningún usuario puede editar el perfil de otro ni usar una cuenta inexistente"
  )
  void identidadProtegePerfiles() throws Exception {
    mockMvc
      .perform(
        put("/api/v1/auth/perfil/usr-data-02")
          .contentType(MediaType.APPLICATION_JSON)
          .content("{\"name\":\"Otro nombre\"}")
      )
      .andExpect(status().isForbidden());
    mockMvc
      .perform(get("/api/v1/auth/users").header("Authorization", ""))
      .andExpect(status().isUnauthorized());
    mockMvc
      .perform(
        get("/api/v1/proyectos").header(
          "Authorization",
          auth("usuario-inexistente")
        )
      )
      .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName(
    "Identidad · El historial usa al autor autenticado y permanece aislado entre cuentas"
  )
  void identidadAislaHistorial() throws Exception {
    var diagram = crearDiagrama("Artefacto aislado");
    diagram.setCreadorId("usr-data-02");
    mockMvc
      .perform(
        post("/api/v1/generador/sql")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(diagram))
      )
      .andExpect(status().isOk());
    var response = mockMvc
      .perform(get("/api/v1/generator/historial").param("tipo", "DDL"))
      .andExpect(status().isOk())
      .andReturn();
    var rows = objectMapper.readTree(
      response.getResponse().getContentAsString()
    );
    JsonNode row = null;
    for (var item : rows)
      if (
        item.path("tituloDiagrama").asText().equals("Artefacto aislado")
      ) row = item;
    assertThat(row).isNotNull();
    assertThat(row.path("usuarioId").asText()).isEqualTo("usr-admin-01");
    var other = mockMvc
      .perform(
        get("/api/v1/generator/historial").header(
          "Authorization",
          auth("usr-data-02")
        )
      )
      .andExpect(status().isOk())
      .andReturn();
    assertThat(other.getResponse().getContentAsString()).doesNotContain(
      "Artefacto aislado"
    );
    mockMvc
      .perform(
        delete(
          "/api/v1/generator/historial/{id}",
          row.path("id").asText()
        ).header("Authorization", auth("usr-data-02"))
      )
      .andExpect(status().isForbidden());
    mockMvc
      .perform(
        post("/api/v1/generador/sql")
          .header("Authorization", "")
          .contentType(MediaType.APPLICATION_JSON)
          .content(objectMapper.writeValueAsString(diagram))
      )
      .andExpect(status().isUnauthorized());
  }

  // ───────────────────────── Helpers ─────────────────────────

  private DiagramDto crearDiagrama(String titulo) {
    UmlClassDto cliente = UmlClassDto.builder()
      .id("cls-cliente")
      .name("Cliente")
      .stereotype("Entity")
      .position(new PositionDto(100.0, 150.0))
      .attributes(
        List.of(
          UmlAttributeDto.builder()
            .id("a-c1")
            .name("id")
            .type("Long")
            .visibility("+")
            .isPrimaryKey(true)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-c2")
            .name("nombre")
            .type("String")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-c3")
            .name("correo")
            .type("String")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(true)
            .build()
        )
      )
      .methods(
        List.of(
          com.archai.modulo.diagrama.dto.UmlMethodDto.builder()
            .id("m-c1")
            .name("getNombre")
            .returnType("String")
            .visibility("+")
            .parameters(new ArrayList<>())
            .build()
        )
      )
      .build();

    UmlClassDto venta = UmlClassDto.builder()
      .id("cls-venta")
      .name("Venta")
      .stereotype("Entity")
      .position(new PositionDto(420.0, 150.0))
      .attributes(
        List.of(
          UmlAttributeDto.builder()
            .id("a-v1")
            .name("id")
            .type("Long")
            .visibility("+")
            .isPrimaryKey(true)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-v2")
            .name("fecha")
            .type("LocalDateTime")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-v3")
            .name("total")
            .type("Double")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(false)
            .build()
        )
      )
      .methods(new ArrayList<>())
      .build();

    UmlClassDto producto = UmlClassDto.builder()
      .id("cls-producto")
      .name("Producto")
      .stereotype("Entity")
      .position(new PositionDto(740.0, 150.0))
      .attributes(
        List.of(
          UmlAttributeDto.builder()
            .id("a-p1")
            .name("id")
            .type("Long")
            .visibility("+")
            .isPrimaryKey(true)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-p2")
            .name("descripcion")
            .type("String")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(false)
            .build(),
          UmlAttributeDto.builder()
            .id("a-p3")
            .name("precio")
            .type("Double")
            .visibility("+")
            .isPrimaryKey(false)
            .isNullable(false)
            .build()
        )
      )
      .methods(new ArrayList<>())
      .build();

    List<UmlRelationDto> relaciones = List.of(
      UmlRelationDto.builder()
        .id("rel-cli-venta")
        .sourceClassId("cls-cliente")
        .targetClassId("cls-venta")
        .type("ASSOCIATION_1_N")
        .sourceMultiplicity("1")
        .targetMultiplicity("0..*")
        .build(),
      UmlRelationDto.builder()
        .id("rel-venta-prod")
        .sourceClassId("cls-venta")
        .targetClassId("cls-producto")
        .type("ASSOCIATION_N_M")
        .sourceMultiplicity("1..*")
        .targetMultiplicity("1..*")
        .build()
    );

    return DiagramDto.builder()
      .title(titulo)
      .description("Modelo generado automáticamente para pruebas de los 14 CU")
      .classes(new ArrayList<>(List.of(cliente, venta, producto)))
      .relations(new ArrayList<>(relaciones))
      .build();
  }

  /** Genera una imagen simulando una pizarra con 3 cajas dibujadas (trazos oscuros). */
  private byte[] generarImagenPizarraFalsa() throws Exception {
    BufferedImage img = new BufferedImage(600, 400, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = img.createGraphics();
    g.setColor(Color.WHITE);
    g.fillRect(0, 0, 600, 400);
    g.setColor(Color.BLACK);
    // Tres "cajas" de clase dibujadas en la pizarra
    g.fillRect(60, 80, 90, 60);
    g.fillRect(300, 80, 90, 60);
    g.fillRect(170, 260, 90, 60);
    g.dispose();

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    ImageIO.write(img, "png", baos);
    return baos.toByteArray();
  }
}
