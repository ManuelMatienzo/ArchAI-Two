-- ==============================================================================
-- 🚀 ArchAI CASE Studio — Esquema de Base de Datos PostgreSQL (Supabase)
-- 🇪🇸 Estructura Oficial en Español
-- ==============================================================================

-- 1. Tabla de Usuarios y Autenticación de Ingenieros
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(64) PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    nombre_usuario VARCHAR(64),
    correo VARCHAR(128) NOT NULL UNIQUE,
    contrasena VARCHAR(128) NOT NULL,
    dni VARCHAR(32),
    rol VARCHAR(64) NOT NULL,
    color_avatar VARCHAR(32) DEFAULT '#2563EB',
    es_anfitrion BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Diagramas y Arquitecturas de Software UML
CREATE TABLE IF NOT EXISTS diagramas (
    id VARCHAR(64) PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion VARCHAR(1000),
    json_diagrama TEXT,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Suscripciones Push para Alertas Críticas (CU-23)
--    Token FCM (Android/iOS) o ExponentPushToken (development build).
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

-- 4. Índices de Búsqueda y Optimización
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre_usuario ON usuarios(nombre_usuario);
CREATE INDEX IF NOT EXISTS idx_diagramas_titulo ON diagramas(titulo);
CREATE UNIQUE INDEX IF NOT EXISTS uk_suscripciones_push_token ON suscripciones_push(token);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_usuario ON suscripciones_push(usuario_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_sala ON suscripciones_push(sala_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_push_proyecto ON suscripciones_push(proyecto_id);
