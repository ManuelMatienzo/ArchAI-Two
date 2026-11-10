package com.archai.modulo.proyecto.repositorio;

import com.archai.modulo.proyecto.entidad.ProyectoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProyectoRepository extends JpaRepository<ProyectoEntity, String> {
    Optional<ProyectoEntity> findByCodigoAcceso(String codigoAcceso);
    Optional<ProyectoEntity> findByCodigoAccesoIgnoreCase(String codigoAcceso);
    List<ProyectoEntity> findByPropietarioId(String propietarioId);

    @Query("SELECT DISTINCT p FROM ProyectoEntity p LEFT JOIN p.miembros m WHERE p.propietario.id = :usuarioId OR m.usuario.id = :usuarioId ORDER BY p.fechaActualizacion DESC")
    List<ProyectoEntity> findProyectosByUsuario(@Param("usuarioId") String usuarioId);
}
