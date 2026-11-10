package com.archai.comun.configuracion;

import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.diagrama.dto.*;
import com.archai.modulo.diagrama.servicio.ServicioDiagrama;
import com.archai.modulo.proyecto.dto.CrearProyectoSolicitudDto;
import com.archai.modulo.proyecto.dto.InvitarMiembroDto;
import com.archai.modulo.proyecto.dto.ProyectoDto;
import com.archai.modulo.proyecto.repositorio.ProyectoRepository;
import com.archai.modulo.proyecto.servicio.ServicioProyecto;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SembradorDatos implements CommandLineRunner {

    private final UsuarioRepository usuarioRepository;
    private final ProyectoRepository proyectoRepository;
    private final ServicioProyecto servicioProyecto;
    private final ServicioDiagrama servicioDiagrama;

    @Override
    public void run(String... args) {
        sembrarUsuarios();
        sembrarProyectosYDiagramas();
    }

    private void sembrarUsuarios() {
        if (!usuarioRepository.existsById("usr-admin-01")) {
            UsuarioEntity admin = UsuarioEntity.builder()
                .id("usr-admin-01")
                .nombre("Ing. Carlos Criado")
                .nombreUsuario("carlos_criado")
                .correo("carlos.criado@archai.io")
                .contrasena("password123")
                .rol("Arquitecto de Software")
                .colorAvatar("#2563EB")
                .esAnfitrion(true)
                .fechaCreacion(LocalDateTime.now())
                .ultimoAcceso(LocalDateTime.now())
                .build();
            usuarioRepository.save(admin);
            System.out.println(" Usuario 'Ing. Carlos Criado' creado en la base SQL configurada.");
        }

        if (!usuarioRepository.existsById("usr-data-02")) {
            UsuarioEntity dataEng = UsuarioEntity.builder()
                .id("usr-data-02")
                .nombre("Dra. Elena Ramos")
                .nombreUsuario("elena_ramos")
                .correo("elena.ramos@archai.io")
                .contrasena("password123")
                .rol("Ingeniero de Datos")
                .colorAvatar("#00E5FF")
                .esAnfitrion(false)
                .fechaCreacion(LocalDateTime.now())
                .ultimoAcceso(LocalDateTime.now())
                .build();
            usuarioRepository.save(dataEng);
            System.out.println(" Usuario 'Dra. Elena Ramos' creado en la base SQL configurada.");
        }

        if (!usuarioRepository.existsById("usr-dev-03")) {
            UsuarioEntity backendDev = UsuarioEntity.builder()
                .id("usr-dev-03")
                .nombre("Ing. Lucas Vaca")
                .nombreUsuario("lucas_vaca")
                .correo("lucas.vaca@archai.io")
                .contrasena("password123")
                .rol("Desarrollador Backend")
                .colorAvatar("#10B981")
                .esAnfitrion(false)
                .fechaCreacion(LocalDateTime.now())
                .ultimoAcceso(LocalDateTime.now())
                .build();
            usuarioRepository.save(backendDev);
            System.out.println(" Usuario 'Ing. Lucas Vaca' creado en la base SQL configurada.");
        }
    }

    private void sembrarProyectosYDiagramas() {
        if (proyectoRepository.count() == 0) {
            // 1. Proyecto Sistema Clínico Hospitalario
            ProyectoDto proy1 = servicioProyecto.crearProyecto(
                CrearProyectoSolicitudDto.builder()
                    .nombre("Sistema Clínico Hospitalario")
                    .descripcion(
                        "Plataforma médica integral con gestión de pacientes, médicos especialistas, consultas y diagnósticos."
                    )
                    .iconoColor("#2563EB")
                    .propietarioId("usr-admin-01")
                    .build()
            );

            servicioProyecto.invitarMiembro(
                proy1.getId(),
                InvitarMiembroDto.builder().correoOUsuario("elena.ramos@archai.io").rolProyecto("ADMINISTRADOR").build()
            );

            servicioProyecto.invitarMiembro(
                proy1.getId(),
                InvitarMiembroDto.builder().correoOUsuario("lucas.vaca@archai.io").rolProyecto("EDITOR").build()
            );

            // Crear diagrama para proyecto 1
            UmlClassDto paciente = UmlClassDto.builder()
                .id("cls-paciente")
                .name("Paciente")
                .stereotype("Entity")
                .position(new PositionDto(100.0, 150.0))
                .attributes(
                    List.of(
                        UmlAttributeDto.builder()
                            .id("p1")
                            .name("id")
                            .type("Long")
                            .visibility("+")
                            .isPrimaryKey(true)
                            .build(),
                        UmlAttributeDto.builder().id("p2").name("nombre").type("String").visibility("+").build(),
                        UmlAttributeDto.builder().id("p3").name("ci").type("String").visibility("+").build(),
                        UmlAttributeDto.builder().id("p4").name("telefono").type("String").visibility("+").build()
                    )
                )
                .methods(List.of())
                .build();

            UmlClassDto medico = UmlClassDto.builder()
                .id("cls-medico")
                .name("Medico")
                .stereotype("Entity")
                .position(new PositionDto(550.0, 150.0))
                .attributes(
                    List.of(
                        UmlAttributeDto.builder()
                            .id("m1")
                            .name("id")
                            .type("Long")
                            .visibility("+")
                            .isPrimaryKey(true)
                            .build(),
                        UmlAttributeDto.builder().id("m2").name("nombre").type("String").visibility("+").build(),
                        UmlAttributeDto.builder().id("m3").name("especialidad").type("String").visibility("+").build(),
                        UmlAttributeDto.builder().id("m4").name("matricula").type("String").visibility("+").build()
                    )
                )
                .methods(List.of())
                .build();

            UmlClassDto consulta = UmlClassDto.builder()
                .id("cls-consulta")
                .name("Consulta")
                .stereotype("Entity")
                .position(new PositionDto(320.0, 380.0))
                .attributes(
                    List.of(
                        UmlAttributeDto.builder()
                            .id("c1")
                            .name("id")
                            .type("Long")
                            .visibility("+")
                            .isPrimaryKey(true)
                            .build(),
                        UmlAttributeDto.builder()
                            .id("c2")
                            .name("fechaConsulta")
                            .type("LocalDateTime")
                            .visibility("+")
                            .build(),
                        UmlAttributeDto.builder().id("c3").name("diagnostico").type("String").visibility("+").build(),
                        UmlAttributeDto.builder().id("c4").name("costo").type("Double").visibility("+").build()
                    )
                )
                .methods(List.of())
                .build();

            UmlRelationDto rel1 = UmlRelationDto.builder()
                .id("rel-1")
                .sourceClassId(paciente.getId())
                .targetClassId(consulta.getId())
                .type("ASSOCIATION_1_N")
                .sourceMultiplicity("1")
                .targetMultiplicity("0..*")
                .build();

            UmlRelationDto rel2 = UmlRelationDto.builder()
                .id("rel-2")
                .sourceClassId(medico.getId())
                .targetClassId(consulta.getId())
                .type("ASSOCIATION_1_N")
                .sourceMultiplicity("1")
                .targetMultiplicity("0..*")
                .build();

            DiagramDto diagClinico = DiagramDto.builder()
                .proyectoId(proy1.getId())
                .creadorId("usr-admin-01")
                .title("Diagrama de Clases - Módulo Consultas")
                .description("Arquitectura relacional del subsistema de consultas médicas.")
                .classes(List.of(paciente, medico, consulta))
                .relations(List.of(rel1, rel2))
                .build();

            DiagramDto guardado = servicioDiagrama.guardarDiagrama(diagClinico);
            servicioDiagrama.crearVersion(
                guardado.getId(),
                "v1.0 - Modelo Clínico Inicial",
                "Creación de entidades Paciente, Medico y Consulta.",
                "usr-admin-01"
            );

            // 2. Proyecto E-Commerce B2B
            servicioProyecto.crearProyecto(
                CrearProyectoSolicitudDto.builder()
                    .nombre("Plataforma E-Commerce B2B")
                    .descripcion("Sistema de ventas empresariales, catálogos mayoristas y facturación automática.")
                    .iconoColor("#10B981")
                    .propietarioId("usr-data-02")
                    .build()
            );

            System.out.println(" Proyectos y diagramas creados en la base SQL configurada.");
        }
    }
}
