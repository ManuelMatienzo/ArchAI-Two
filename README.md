# ArchAI — colaboración con IA y Modo Viaje

Plataforma CASE con React, Spring Boot y cliente Android React Native/Expo. La conversación, el contexto de ArchAI y las propuestas pertenecen a la sala del diagrama y se comparten entre web y móvil.

## Configuración privada

| Archivo | Contenido | Compartir por Git |
|---|---|---|
| `.env` en la raíz | SQL, `SPRING_DATA_MONGODB_URI`, puerto y JWT opcional | No |
| `backend/.env.local` | Gemini, Claude, Ollama y política de respaldo | No |
| `frontend/.env.local` | `VITE_ARCHAI_API_URL`, dirección pública de Spring Boot | No |
| `mobile/.env` | `EXPO_PUBLIC_ARCHAI_API_URL` y `EXPO_PUBLIC_EAS_PROJECT_ID` | No |
| `mobile/google-services.json` | Configuración Android del proyecto Firebase | No |
| Credencial FCM de cuenta de servicio | Subir a las credenciales del proyecto Expo/EAS | No |

Los archivos `.env.example` contienen plantillas. Gemini y Claude se consumen exclusivamente desde Spring Boot. Ninguna clave de inferencia debe tener prefijo `VITE_` o `EXPO_PUBLIC_`.

La configuración del proceso tiene prioridad sobre los archivos. Las variables de IA se cargan primero desde `backend/.env.local`; después se completan los valores generales del `.env`. Reiniciar Spring Boot al cambiar claves, URI o políticas.

## Arranque

Requisitos: Java 17 o superior, Maven, Node 24 compatible con Expo y MongoDB Atlas o MongoDB local. Ollama es necesario para usar el modo Local.

1. Preparar `.env` y `backend/.env.local` desde las plantillas. Poner un nombre de base de datos en la URI de Atlas; si no se especifica, se utiliza `archai_sessions`.
2. Desde `backend`, ejecutar `mvn spring-boot:run`.
3. Desde `frontend`, ejecutar `npm ci` y `npm run dev`. El Vite existente conserva su configuración HTTPS/mkcert. Para otra dirección de backend, configurar `VITE_ARCHAI_API_URL` y reiniciar Vite.
4. Desde `mobile`, ejecutar `npm ci` y `npx expo start`. Configurar en Ajustes la dirección accesible del backend, terminada en `/api/v1`. Desde un teléfono, `localhost` apunta al propio teléfono.

Para conexión remota, web y Android necesitan una dirección HTTPS del backend accesible desde Internet y compatible con WebSocket. En LAN puede usarse la IP de la laptop. Mantener el mismo backend y las mismas bases para compartir proyectos y sesiones.

El perfil `local-test` es aislado: utiliza H2 en memoria y no importa las credenciales SQL ni MongoDB del `.env` general. Para probar persistencia en ese perfil, configurar explícitamente `ARCHAI_TEST_MONGODB_URI` y una URL H2 de archivo. No usar H2 en memoria para conservar una presentación entre reinicios.

## Comportamiento de los casos de uso

La numeración sigue el documento del segundo ciclo: CU-15 a CU-23.

| CU | Resultado |
|---|---|
| 15 | Invocar `@ArchAI` en el chat compartido; la respuesta puede conversar o proponer UML sin modificar el modelo oficial. |
| 16 | Abrir una propuesta en la pizarra como borrador. Las modificaciones pendientes se distinguen del diseño oficial. |
| 17 | Editar, aprobar total o parcialmente, rechazar y solicitar correcciones. Las eliminaciones requieren selección y confirmación. |
| 18 | Chat común para miembros y lectores, con identidad autenticada, estados de envío y respuestas de IA compartidas. |
| 19 | Contexto del equipo: diagrama actual, participantes, conversación y decisiones anteriores. |
| 20 | El anfitrión selecciona Nube o Local para la sala. Nube usa Gemini y puede respaldarse con Claude; Local utiliza Ollama sin cambiar silenciosamente a nube. |
| 21 | Estado y conversación en MongoDB, recuperación entre jornadas, puntos de control y hasta 50 pasos de deshacer/rehacer compartidos. |
| 22 | Android supervisa el lienzo, inspecciona propuestas, conversa e invoca a ArchAI. La moderación se realiza en la web. |
| 23 | Bandeja de actividad y envío nativo Expo Push/FCM para propuestas, decisiones, menciones, generaciones y cambios estructurales. |

El chat se abre desde el icono de ArchAI del lateral izquierdo o desde «Asistente IA». «Conversación» y «Revisar propuesta» usan el mismo panel y los componentes visuales del estudio. Las consultas se conservan en el historial de su sala.

«Observación automática» comienza apagada. Revisa cambios estructurales tras 15 segundos de pausa, como máximo una vez por minuto y diez veces por hora. En nube usa solo Gemini; nunca Claude. Mover o ampliar la vista no dispara inferencia. Se pausa cuando sale el último participante y al reiniciar el backend.

Cerrar la pestaña solicitante no cancela una consulta ya aceptada por el servidor. Tras una interrupción del backend se conserva la solicitud como interrumpida y se exige un reintento explícito; no se vuelven a consumir APIs automáticamente.

Los mensajes humanos conservados sin conexión pueden enviarse al reconectar. Las consultas con `@ArchAI` requieren pulsar Reintentar. La caché del navegador y de Android se separa por cuenta y sala.

## Persistencia y actualización SQL

SQL conserva cuentas, proyectos y versiones oficiales. MongoDB conserva salas, mensajes, contexto, borradores, historial de revisión, puntos de control y actividad. Una cola SQL durable permite reintentar sincronización cuando MongoDB no está disponible.

La migración del módulo `db/sesiones/V1__cola_documental.sql` agrega `operaciones_documentales`. Flyway mantiene su historial independiente en `flyway_sesiones_schema_history`, evitando colisiones con versiones SQL ya aplicadas por otros módulos. El historial anterior del proyecto se conserva y no se repara ni sobrescribe. No es necesario ejecutar sentencias SQL manualmente ni borrar las tablas existentes. La aprobación y su intención de persistencia/notificación se confirman en la misma transacción SQL.

«Guardar sesión» crea un punto de control. Restaurarlo recupera modelo y propuestas, conserva la conversación y crea una nueva revisión. Las operaciones antiguas o concurrentes se rechazan antes de sobrescribir el trabajo del equipo.

## Notificaciones Android

Se mantiene la app React Native existente. No se convirtió a PWA ni usa Web Push/VAPID. **Expo Go permite probar chat, diagramas y actividad; las notificaciones remotas en segundo plano requieren una APK propia con Firebase.**

Consultar [la preparación Android](mobile/README.md). La aceptación del envío por Expo no garantiza que el sistema operativo lo haya mostrado; su recepción y apertura deben comprobarse en el teléfono.

## Pruebas

Estado del avance al 10 de noviembre de 2026: implementación de CU-15 a CU-23 disponible para revisión. Pasaron 66 pruebas del backend (incluidas las regresiones CU-01 a CU-14), la compilación del frontend, sus cinco recorridos unitarios, TypeScript y la exportación Android, y 54 comprobaciones del lienzo móvil. Se verificaron colaboración STOMP, permisos, aprobación parcial y recuperación con MongoDB; también PostgreSQL y Atlas tras reiniciar el servidor. Claude y Ollama respondieron en pruebas reales; Gemini devolvió HTTP 503 y se comprobó el respaldo con Claude.

**Pendiente de aceptación móvil:** terminar la compilación nativa/firmada y comprobar instalación, recepción y apertura de push en un teléfono Android. Pasar TypeScript y exportar JavaScript no sustituye esas pruebas. La conexión LAN del teléfono al backend ya se comprobó. El recorrido remoto mediante HTTPS requiere una dirección de servidor accesible desde esa red.

Desde `backend`: `mvn test`. Si se utiliza la caché Maven local del equipo: `mvn '-Dmaven.repo.local=../.maven-cache' test`.

Desde `frontend`:

```powershell
node tests/proposalDraft.test.mjs
node tests/proposalAgent.test.mjs
node tests/proposalRendering.test.mjs
node tests/projectDiagrams.test.mjs
node tests/roomChat.test.mjs
npm run build
```

Desde `mobile`: `npx tsc --noEmit` y `npx expo export --platform android --output-dir .expo/export-test`.

Los recorridos de red requieren backends aislados. `tests/fakeModels.server.mjs` sirve proveedores y push simulados en `127.0.0.1:18029`. Ejecutar `tests/teamSession.integration.mjs` sobre el backend de prueba `18026`, configurado con esas URLs y MongoDB de prueba. Cubre identidad, permisos, aislamiento, idempotencia, contexto, moderación, motores, observación, notificaciones y sincronización.

`tests/teamSession.integration.mjs --presence` comprueba múltiples pestañas y pausa por inactividad. `--prepare-restart`, seguido de detener/reiniciar el backend aislado y ejecutar `--resume`, comprueba recuperación durable sin repetir inferencias.

`tests/proposalReview.integration.mjs` comprueba la integración de moderación anterior; `tests/proposalBroker.test.mjs` usa la sesión auxiliar de `teamSession.integration.mjs` para validar autenticación y entrega STOMP.

**Prueba con consumo real:** `node tests/cloudProposal.integration.mjs --live` requiere el backend aislado `18027`, claves configuradas y controles de prueba habilitados. Consume una consulta por proveedor y una de respaldo. `--local` añade Ollama; `--mode=gemini`, `--mode=claude` o `--mode=auto` limita el recorrido; `--natural` prueba el respaldo sin simular la indisponibilidad de Gemini. Los datos son ficticios y las sesiones auxiliares se guardan en `node_modules/.cache`, excluido de Git.

Ver [la guía de pruebas manuales](PRUEBAS-MANUALES.md) y [las políticas de IA](CLOUD-AI.md). La compilación no sustituye la prueba en dos navegadores y en un teléfono físico.
