# Motores de IA de la sala

Todas las consultas del chat se ejecutan desde Spring Boot. Web y Android comparten una cola y un contexto por sala. No se incluyen claves de proveedor en los clientes.

## Configuración privada

Copiar las variables de IA de `backend/.env.example` a `backend/.env.local`:

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_WORKSPACE_ID=
ARCHAI_CLAUDE_FALLBACK_ENABLED=true
ARCHAI_AI_TEST_CONTROLS=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
```

El workspace de Anthropic es opcional según el tipo de clave. Las variables del proceso y propiedades JVM tienen prioridad. Reiniciar Spring Boot después de cambiar configuración.

El anfitrión elige **Nube** o **Local** desde Preferencias del asistente. Nube usa Gemini y puede usar Claude como respaldo si `ARCHAI_CLAUDE_FALLBACK_ENABLED=true`. Local usa el modelo Ollama seleccionado, sin respaldo silencioso a nube. La decisión se comparte entre todos los participantes y se conserva para la sala.

## Contrato y costos

`POST /api/v1/colaboracion/salas/{room}/mensajes?diagramId=...` recibe `{id,text}`. El servidor asigna identidad y secuencia, detecta `@ArchAI`, encola una sola inferencia y distribuye sus estados mediante `chat_message` en STOMP. Repetir el mismo identificador y texto devuelve el mensaje existente sin consumir otra inferencia.

Las respuestas incluyen texto, proveedor/modelo, duración y tokens. Cuando hay cambios UML se crea una propuesta pendiente: la respuesta no cambia el diseño oficial. Pueden conversar también los lectores del proyecto; la moderación requiere permiso de edición.

El modelo recibe el diagrama canónico, las intervenciones recientes, un extracto acotado de decisiones anteriores y decisiones de moderación. El historial íntegro se conserva en MongoDB, aunque no se reenvía entero en cada llamada.

Cuota, red, respuestas inválidas y fallos 5xx pueden activar un respaldo Claude en consultas explícitas. Errores de clave/permisos/parámetros, rechazos de seguridad y cancelaciones no activan otro proveedor. Gemini se pausa cinco minutos tras un 429 y treinta segundos tras dos fallos temporales. Se conservan resultados y errores para evitar reejecución automática.

La observación automática empieza apagada, espera 15 segundos tras cambios estructurales y limita a una revisión/minuto y diez/hora. En nube usa solo Gemini. Desactivarla cancela revisiones automáticas pendientes; salir todos o reiniciar el servidor también la pausa. No se llama a un modelo por pan/zoom o por cada mensaje humano.

El límite de salida del chat es 2048 tokens por intento. Gemini tiene un plazo HTTP de 20 segundos, Claude de 30 y Ollama de 90. No equivalen a un presupuesto monetario total; no se garantiza una latencia fija.

Los generadores anteriores de texto/código usan el adaptador autenticado `/api/v1/ia/contenido` y el motor compartido de la sala. El OCR de fotografías conserva su servicio de visión Gemini; en Local solicita cambiar a Nube antes de procesar una imagen y no consume nube silenciosamente.

## Controles de desarrollo

Con frontend en desarrollo, backend `local-test` y `ARCHAI_AI_TEST_CONTROLS=true`, las preferencias muestran Solo Gemini, Solo Claude y el interruptor de respaldo para pruebas. En producción no aparecen y el backend rechaza overrides. La política final se configura en el servidor.

El perfil `local-test` aísla SQL y MongoDB del `.env` general. Importa únicamente las variables privadas permitidas de IA/Expo/Ollama. Para persistencia de prueba necesita `ARCHAI_TEST_MONGODB_URI` explícito y, si debe sobrevivir al reinicio, una URL H2 de archivo.

Ver [las pruebas automáticas y manuales](README.md). `tests/cloudProposal.integration.mjs --live` consume consultas reales; ejecutar solo sobre el backend aislado 18027 y utilizar `--mode=...` para verificar únicamente el proveedor necesario.
