package com.archai.modulo.push.entidad;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * CU-23 — Suscripción push de un dispositivo móvil.
 *
 * <p>El token es el identificador que entrega Firebase Cloud Messaging (FCM) en Android
 * o Expo Push en desarrollo. Se guarda el último usuario, sala y proyecto conocidos para
 * poder dirigir las alertas críticas al ingeniero en tránsito sin inundar a todos los usuarios.</p>
 */
@Entity
@Table(
        name = "suscripciones_push",
        uniqueConstraints = @UniqueConstraint(name = "uk_suscripciones_push_token", columnNames = "token")
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SuscripcionPush {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    /** Token FCM (Android) o ExponentPushToken (Expo Go / development build). */
    @Column(name = "token", nullable = false, length = 512)
    private String token;

    @Column(name = "usuario_id", length = 64)
    private String usuarioId;

    /** Última sala/proyecto abierto por el dispositivo; permite alertas dirigidas. */
    @Column(name = "sala_id", length = 64)
    private String salaId;

    @Column(name = "proyecto_id", length = 64)
    private String proyectoId;

    /** mobile-react-native | android | ios */
    @Column(name = "plataforma", length = 64)
    private String plataforma;

    /** Nombre legible del dispositivo (opcional, solo para soporte interno). */
    @Column(name = "dispositivo", length = 128)
    private String dispositivo;

    @Column(name = "activa")
    @Builder.Default
    private Boolean activa = Boolean.TRUE;

    @Column(name = "fecha_registro")
    private LocalDateTime fechaRegistro;

    @Column(name = "fecha_actualizacion")
    private LocalDateTime fechaActualizacion;

    @PrePersist
    public void alCrear() {
        if (this.id == null || this.id.isBlank()) {
            this.id = UUID.randomUUID().toString();
        }
        if (this.activa == null) {
            this.activa = Boolean.TRUE;
        }
        if (this.fechaRegistro == null) {
            this.fechaRegistro = LocalDateTime.now();
        }
        this.fechaActualizacion = LocalDateTime.now();
    }

    @PreUpdate
    public void alActualizar() {
        this.fechaActualizacion = LocalDateTime.now();
    }
}
