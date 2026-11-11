# Recorrido manual del segundo ciclo

Preparar dos cuentas del mismo proyecto en perfiles de navegador separados: un propietario/editor y un lector. Abrir un tercer perfil con otro proyecto. En Android, usar una cuenta que pertenezca al primero y la misma dirección de Spring Boot. Usar datos de prueba.

| Prueba | Acción | Resultado esperado |
|---|---|---|
| Chat humano | Enviar «Acordamos usar UUID». | Ambos miembros lo ven una vez con el nombre real. No responde la IA ni se consume inferencia. |
| Contexto | Enviar «@ArchAI ¿Qué decidimos sobre los identificadores?». | Aparece esperando/pensando y luego una respuesta compartida que recuerda la decisión. El tercer proyecto no la recibe. |
| Propuesta | Pedir Cita con id y fecha, relacionada con Paciente. | Se muestra explicación, proveedor/modelo y «Ver en pizarra». El diseño oficial permanece igual. |
| Vista previa | Abrir la propuesta. | Se ve el borrador diferenciado y la revisión en el panel izquierdo. Las modificaciones no se aplican todavía. |
| Aprobación parcial | Proponer dos clases, seleccionar una y aprobarla desde el editor. | Solo se incorpora la selección; lo restante sigue pendiente y los miembros reciben el mismo estado. |
| Lector | Intentar moderar desde la cuenta lectora. | Puede conversar e invocar IA; no puede editar ni aprobar. No aparecen controles de moderación activos. |
| Conflicto | Editar el modelo oficial y después aprobar un borrador basado en la revisión anterior. | Se solicita validar contra el modelo actual; no se sobrescriben cambios silenciosamente. |
| Eliminación | Pedir explícitamente eliminar una clase con relaciones. | Se señalan en rojo los elementos afectados. «Revisar eliminaciones» abre una confirmación; Cancelar conserva el modelo. Confirmar aplica solo lo seleccionado y conserva una versión anterior. |
| Corrección | Rechazar pendientes con feedback. | La decisión aparece en el historial y se solicita otra propuesta usando el contexto del equipo. |
| Recuperación | Guardar sesión, salir y regresar. | Vuelven chat, modelo y propuestas; no se realizan consultas pagadas para reconstruir el historial. |
| Historial compartido | Deshacer/rehacer desde un editor; restaurar un punto de control. | Cambia el modelo para todos. Restaurar no borra los mensajes posteriores. |
| Local | El anfitrión cambia a Local, comprueba modelos y selecciona uno disponible. | Todos ven Local. Una consulta muestra Ollama y el modelo real; no se usa nube aunque Ollama falle. |
| Nube | Cambiar a Nube y pedir una mejora. | Usa Gemini cuando está disponible y Claude si ocurre un fallo recuperable y el respaldo está habilitado. Un fallo de clave o permisos muestra un error. |
| Observación | Activar los ojos y editar la estructura. Esperar una pausa de al menos 15 segundos. | Se genera como máximo una revisión por minuto y diez por hora. En nube no usa Claude. Pan/zoom no consume inferencia. |
| Presencia | Abrir dos pestañas con la misma cuenta y cerrar una. Después cerrar la última. | La cuenta sigue presente hasta cerrar la última; sin participantes se apagan los ojos. Las consultas explícitas ya aceptadas pueden terminar. |
| Desconexión | Perder conexión y escribir un mensaje humano y una consulta IA. Reconectar. | El humano puede reenviarse una vez. La consulta IA pide Reintentar. No aparecen mensajes de otra sala/cuenta. |
| Móvil | Abrir chat, pedir a ArchAI y revisar una propuesta. | Comparte mensajes con la web. El lienzo permite inspección y navegación; la aprobación se realiza desde la web. |
| Actividad | Aprobar/rechazar, generar un ZIP, mencionar al usuario por `@nombreUsuario`. | Llegan las novedades correspondientes a la bandeja móvil. Los cambios estructurales se agrupan cada 30 segundos. |
| Push físico | Con APK propia y permisos concedidos, dejar Android en segundo plano y generar una propuesta desde la web. | Se recibe una notificación; tocarla abre la sala y la propuesta/chat adecuados. Probar también con la app cerrada. |
| Regresión | Editar clases/relaciones, generar SQL/backend, exportar e importar XMI y guardar el proyecto. | Las funciones anteriores conservan su comportamiento y respetan permisos de la cuenta. |

No repetir innecesariamente pruebas con APIs de pago. Para probar errores, cancelación y respaldo varias veces, utilizar los proveedores simulados del recorrido de integración. La latencia depende de cada proveedor y del equipo; no se garantiza un límite de 1,8 segundos.
