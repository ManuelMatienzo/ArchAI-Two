-- ==============================================================================
-- CU-23 — Recibir Alertas Push de Cambios Críticos
-- Suscripciones de dispositivos móviles (FCM / Expo Push).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS suscripciones_push (
    id VARCHAR(64) PRIMARY KEY,
    token VARCHAR(512) NOT NULL,
    usuario_id VARCHAR(64),
    sala_id VARCHAR(64),
    proyecto_id VARCHAR(64),
    plataforma VARCHAR(64),
    dispositivo VARCHAR(128),
    activa BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_suscripciones_push_token ON suscripciones_push(token);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_usuario ON suscripciones_push(usuario_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_sala ON suscripciones_push(sala_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_proyecto ON suscripciones_push(proyecto_id);
