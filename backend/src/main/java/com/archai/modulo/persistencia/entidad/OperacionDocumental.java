package com.archai.modulo.persistencia.entidad;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/** Transactional outbox: never contains API credentials or authentication tokens. */
@Entity
@Table(name = "operaciones_documentales")
@Getter
@Setter
@NoArgsConstructor
public class OperacionDocumental {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String coleccion;

    @Column(name = "documento_id", nullable = false, length = 240)
    private String documentoId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String contenido;

    @Column(name = "creada_en", nullable = false)
    private Instant creadaEn = Instant.now();

    public OperacionDocumental(String collection, String id, String json) {
        coleccion = collection;
        documentoId = id;
        contenido = json;
    }
}
