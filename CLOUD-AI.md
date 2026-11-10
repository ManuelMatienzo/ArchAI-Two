# Propuestas colaborativas con Gemini y Claude

CU-15/16/17 utilizan Spring Boot para las propuestas en nube. El modo Local conserva Ollama. El proveedor de nube principal es Gemini; Claude Sonnet respalda únicamente las consultas y correcciones explícitas del equipo. Las revisiones automáticas nunca llaman a Claude.

## Configuración

Copiar las variables de IA de `backend/.env.example` a **`backend/.env.local`**, excluido de Git:

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_WORKSPACE_ID=
ARCHAI_CLAUDE_FALLBACK_ENABLED=true
ARCHAI_AI_TEST_CONTROLS=true
```

El workspace es opcional y se requiere cuando la clave Anthropic no está asociada a uno. Las variables del proceso y propiedades JVM tienen prioridad sobre el archivo. Reiniciar el backend después de cambiar claves o políticas. `local-test` solo importa las variables de IA de la configuración privada; conserva H2, sin importar la base configurada en el `.env` general.

Desde `backend`:

```powershell
mvn '-Dmaven.repo.local=../.maven-cache' '-Dspring-boot.run.profiles=local-test' spring-boot:run
```

Los controles aparecen dentro de Preferencias del asistente → Nube únicamente con frontend en desarrollo, perfil backend `local-test` y `ARCHAI_AI_TEST_CONTROLS=true`. Seleccionar Automático, Solo Gemini o Solo Claude. El interruptor de respaldo afecta la próxima consulta explícita y no puede habilitar un respaldo desautorizado por el servidor. Las consultas en curso conservan su selección.

Para entrega final usar `ARCHAI_AI_TEST_CONTROLS=false`. El respaldo se gobierna con `ARCHAI_CLAUDE_FALLBACK_ENABLED`; no tiene un interruptor adicional en producción. El servidor rechaza los overrides de prueba fuera de `local-test` aunque se manipule el cliente.

Las claves de este flujo no utilizan prefijo `VITE_` ni se envían al navegador. Los servicios anteriores de OCR, generación y asistente clásico conservan su configuración Gemini independiente; no se migraron en este cambio.

## Contrato y límites

- El solicitante autentica y registra la consulta por STOMP. Solo ese usuario, con permisos de edición del diagrama asociado a la sala, puede ejecutarla en `POST /api/v1/colaboracion/salas/{salaId}/inferencia/{id}`. El cuerpo es `{}` en producción; en desarrollo admite `provider`, `allowFallback` y `simulateGeminiFailure`.
- `GET .../inferencia?diagramId=...` devuelve disponibilidad de configuración, modelos y permisos de pruebas, nunca claves. `DELETE .../inferencia/{id}` cancela el trabajo y evita iniciar un respaldo posterior.
- La respuesta contiene `content`, `provider`, `model`, `durationMs`, `inputTokens`, `outputTokens`. El cliente normaliza el borrador y distribuye el resultado por el evento STOMP existente. Consultar no aprueba ni modifica el diagrama.
- Gemini dispone de 20 segundos y Claude de 30; máximo 2048 tokens de salida por intento. Los límites HTTP se pueden ajustar con propiedades JVM `archai.ia.gemini-timeout-seconds` y `archai.ia.claude-timeout-seconds`. El cliente admite el recorrido híbrido desde Ollama con margen hasta 125 segundos.
- Cuota agotada, red, fallos 5xx y respuestas inválidas pueden activar un único respaldo. Cancelaciones, rechazos de seguridad y errores de clave, permisos o parámetros no activan otro proveedor.
- Tras un 429 se pausa Gemini cinco minutos; tras dos fallos temporales, treinta segundos. Las revisiones automáticas no pasan a Claude durante esas pausas. La simulación de fallo no altera la pausa real.
- Repetir la misma operación reutiliza su respuesta o error sin otra inferencia. Las operaciones son efímeras durante esta instancia del backend; no hay migraciones ni historial durable nuevo. Se depuran después de quince minutos. El límite por respuesta no equivale a un presupuesto monetario total: revisar consumo y saldo en las consolas de proveedores.

## Verificación

Desde `backend`: `mvn '-Dmaven.repo.local=../.maven-cache' '-Dspring.profiles.active=local-test' test`.

Desde `frontend`, con Node compatible: ejecutar `node tests/proposalAgent.test.mjs`, `node tests/proposalDraft.test.mjs`, `node tests/proposalRendering.test.mjs` y `npm run build`.

La prueba `node tests/proposalReview.integration.mjs` prepara usuarios y proyecto ficticios sobre el backend local-test. Luego **`node tests/cloudProposal.integration.mjs --live` consume consultas reales**: una por proveedor y una de respaldo con fallo simulado. `--mode=gemini`, `--mode=claude` o `--mode=auto` limita los recorridos. `--natural` evita simular el fallo de Gemini. No ejecutar repetidamente sin revisar el consumo.

Para probar visualmente, enviar: «Propón Cita con id Long y fecha LocalDateTime; un Paciente existente tiene muchas citas». Verificar proveedor real en el chat; abrir en pizarra, editar, aprobar parcialmente y rechazar lo pendiente desde dos sesiones. Otra sala no debe recibirlo. Local no debe invocar servicios de nube. No se garantiza una latencia fija.
