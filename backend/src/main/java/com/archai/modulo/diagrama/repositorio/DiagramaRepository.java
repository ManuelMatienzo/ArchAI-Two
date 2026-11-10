package com.archai.modulo.diagrama.repositorio;

import com.archai.modulo.diagrama.entidad.DiagramaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DiagramaRepository extends JpaRepository<DiagramaEntity, String> {
    @org.springframework.data.jpa.repository.Query("select d from DiagramaEntity d left join fetch d.proyecto p left join fetch p.propietario left join fetch d.creador where d.id = :id")
    java.util.Optional<DiagramaEntity> findForReview(@org.springframework.data.repository.query.Param("id") String id);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select d from DiagramaEntity d where d.id = :id")
    java.util.Optional<DiagramaEntity> findForUpdate(@org.springframework.data.repository.query.Param("id") String id);
    List<DiagramaEntity> findByProyectoId(String proyectoId);
    List<DiagramaEntity> findByCreadorId(String creadorId);
    int countByProyectoId(String proyectoId);
}
