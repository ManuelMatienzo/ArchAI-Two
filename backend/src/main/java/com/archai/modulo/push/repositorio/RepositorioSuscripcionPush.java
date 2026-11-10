package com.archai.modulo.push.repositorio;

import com.archai.modulo.push.entidad.SuscripcionPush;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * CU-23 — Acceso a las suscripciones push persistidas.
 */
public interface RepositorioSuscripcionPush extends JpaRepository<SuscripcionPush, String> {

    Optional<SuscripcionPush> findByToken(String token);

    List<SuscripcionPush> findByActivaTrue();

    List<SuscripcionPush> findByUsuarioIdAndActivaTrue(String usuarioId);

    List<SuscripcionPush> findBySalaIdAndActivaTrue(String salaId);

    List<SuscripcionPush> findByProyectoIdAndActivaTrue(String proyectoId);

    long countByActivaTrue();

    long countByUsuarioIdAndActivaTrue(String usuarioId);

    long deleteByToken(String token);

    long deleteByUsuarioId(String usuarioId);
}
