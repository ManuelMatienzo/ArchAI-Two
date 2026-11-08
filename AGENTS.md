# AGENTS.md — ArchAI Project (workspace raíz)

Este archivo aplica a TODO el workspace: `ArchAI-App` (código fuente) + `Obsidian_ArchAI_Vault` (documentación).
También aplica a cualquier IDE de agente (Antigravity, OpenCode, Cursor, etc.).

## ⛔ REGLA #1 — LEE EL OBSIDIAN ANTES DEL CÓDIGO (obligatorio)

**Antes de leer, editar o generar cualquier archivo de código fuente, primero debes leer
la documentación del sistema en `Obsidian_ArchAI_Vault`.**

Es la fuente única de verdad: contiene la lógica completa, los flujos, las conexiones
frontend↔backend, el agente Ollama, la exportación XMI/EA y cada caso de uso (CU-01..CU-15).
Solo después de cargar el contexto de la bóveda puedes abrir el código para detalles puntuales
(firmas, props, líneas). Esto reduce tokens y evita malentendidos.

### Orden de lectura recomendado

1. `Obsidian_ArchAI_Vault/00 - INDICE GENERAL MOC.md` — mapa maestro.
2. `Obsidian_ArchAI_Vault/07 - GUIA RAPIDA PARA AGENTES Onboarding.md` — **lectura esencial** (stack, entry points, arranque, flujos, FAQ).
3. Según la tarea:
   - Frontend → `Obsidian_ArchAI_Vault/05 - MAPA DE MODULOS FRONTEND Y CONEXIONES.md`
   - Backend → `Obsidian_ArchAI_Vault/06 - BACKEND SPRING BOOT API Y MODULOS.md`
   - IA/Ollama → `Obsidian_ArchAI_Vault/03 - AGENTE IA LOCAL OLLAMA (FASE 1 GENERAR Y MODIFICAR).md`
   - XMI/Enterprise Architect → `Obsidian_ArchAI_Vault/04 - EXPORTACION XMI ENTERPRISE ARCHITECT Y OMG.md`
   - STOMP/WebSocket → `Obsidian_ArchAI_Vault/02 - PROTOCOLO COLABORATIVO STOMP Y DIAGNOSTICO DE ERRORES.md`
   - Compilar/ejecutar/probar → `Obsidian_ArchAI_Vault/99 - GUIA OPERATIVA Y SUITE DE PRUEBAS.md`
   - Un caso de uso específico → `Obsidian_ArchAI_Vault/CU-XX ....md`

## 🚫 REGLA #2 — NADA DE GIT PUSH / COMMIT

**El usuario NO hace commits ni pushes desde aquí**: los commits los hace el usuario a mano.
Además, hay **trabajo sin commitear** del usuario que NO se debe sobrescribir:
`agenteDiagrama.ts`, `exportarXmiEA.ts`, `ollamaService.ts`, `FloatingAiAssistant.tsx`,
`index.css`, `aiVoiceParser.ts`, `vite.config.ts`. Realiza ediciones quirúrgicas con `edit`.

## 🛡️ REGLA #3 — CERO ELEMENTOS DE DEPURACIÓN EN LA UI COMERCIAL (estricto)

**Cuando el usuario solicite comprobar, revisar o conectar algo en la conversación, NUNCA agregues badges, banners de diagnóstico, números de puerto (ej. `(8000)`), estados de servidor en vivo o botones de "modo prueba / evaluación" en la interfaz visual de la aplicación.**

- **El cliente final NO debe ver detalles de depuración interna:** La UI (tanto Web como Móvil) debe lucir 100% limpia, comercial y profesional.
- **Manejo de fallos:** Si un servicio o backend está caído, se notifica únicamente como un mensaje de error estándar al enviar el formulario (ej. *"No se pudo conectar con el servidor. Intenta de nuevo más tarde."*), jamás con un cartel de diagnóstico permanente en pantalla.
- **Cero etiquetas de prueba:** No colocar textos como *"Para Evaluación"*, *"Sin Backend"*, o IPs locales (`10.0.2.2`) en pantallas de producción.

## ⚡ Datos del entorno

| Componente | Valor |
|---|---|
| Frontend (dev) | Vite en **HTTPS `https://localhost:443`** (mkcert), host `main.d2nlfe2rkbsyt.amplifyapp.com` |
| Backend | **`http://localhost:8000/api/v1`** (`mvn spring-boot:run`) |
| WebSocket | `ws://localhost:8000/ws-stomp` (broker `/topic`,`/queue` · app `/app`) |
| Ollama | `http://127.0.0.1:11434` (proxy Vite `/api/ollama`; modelos `qwen2.5:0.5b/1.5b/3b`) |
| BD local | H2 en memoria (PostgreSQL en nube si `SPRING_DATASOURCE_URL`) |

## 🧭 Reglas de edición

- **Componentes unificados**: arquitectura limpia en inglés (`voice/`, `canvas/`,
  `layout/`, `dock/`, `collaboration/`, `auth/`, `glass/`, `navbar/`). Se eliminaron las
  carpetas alias redundantes en español para evitar duplicaciones y confusión.
- **Agente Ollama = 100% cliente**: no pasa por Spring. Pasa por proxy `/api/ollama`
  (el fix CORS en `vite.config.ts` no debe reescribirse).
- Si documentas en el vault: frontmatter YAML (title/type/date/tags), secciones numeradas,
  mermaid, tablas — igual que el resto de notas.