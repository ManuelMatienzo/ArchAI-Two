package com.archai.modulo.persistencia.repositorio;

import com.archai.modulo.persistencia.entidad.OperacionDocumental;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperacionDocumentalRepository extends JpaRepository<OperacionDocumental, Long> {
    List<OperacionDocumental> findTop100ByOrderByIdAsc();
    List<OperacionDocumental> findByColeccionOrderByIdAsc(String coleccion);
    List<OperacionDocumental> findByColeccionAndDocumentoIdOrderByIdAsc(String coleccion, String documentoId);
}
