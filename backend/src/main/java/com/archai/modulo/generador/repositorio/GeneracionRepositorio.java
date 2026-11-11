package com.archai.modulo.generador.repositorio;

import com.archai.modulo.generador.entidad.GeneracionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repositorio del historial de generaciones (CU-10...CU-14).
 */
@Repository
public interface GeneracionRepositorio
  extends JpaRepository<GeneracionEntity, String>
{
  List<GeneracionEntity> findTop50ByOrderByFechaCreacionDesc();

  List<GeneracionEntity> findByTipoOrderByFechaCreacionDesc(String tipo);

  List<GeneracionEntity> findTop50ByUsuarioIdOrderByFechaCreacionDesc(
    String usuarioId
  );

  List<GeneracionEntity> findTop50ByUsuarioIdAndTipoOrderByFechaCreacionDesc(
    String usuarioId,
    String tipo
  );
}
