# ArchAI Mobile — Modo Viaje

Cliente React Native/Expo para Android. Comparte con la web el chat, el contexto de ArchAI, las propuestas y la actividad del proyecto. Permite supervisar el lienzo, consultar clases y propuestas e invocar `@ArchAI`. La edición y aprobación del modelo se realizan en la web.

## Uso con Expo Go

1. Ejecutar `npm ci` desde `mobile` usando Node compatible con el SDK instalado.
2. Copiar `.env.example` a `.env`. `EXPO_PUBLIC_ARCHAI_API_URL` debe apuntar a Spring Boot y terminar en `/api/v1`.
3. Ejecutar `npx expo start` y abrirlo en el teléfono.
4. En Ajustes puede cambiarse la dirección del backend y comprobar la conexión. La app y el backend deben ser accesibles entre sí. Una IP LAN sirve en la misma red/hotspot; para trabajo remoto se necesita una dirección HTTPS pública con WebSocket.

Expo Go permite probar chat, propuestas, diagramas y la bandeja de actividad. Las notificaciones remotas con la app cerrada requieren una compilación propia: no se simulan como si fueran push reales.

## APK y notificaciones nativas

1. Crear o elegir el proyecto del equipo en Expo/EAS.
2. Ejecutar `npx eas-cli@latest login` y `npx eas-cli@latest init` desde `mobile`.
3. Guardar el UUID del proyecto en `EXPO_PUBLIC_EAS_PROJECT_ID` de `.env`, o en `extra.eas.projectId` de `app.json`. Debe estar disponible también en el entorno de compilación EAS usado. Es configuración pública, no una clave de inferencia.
4. En Firebase, registrar una aplicación Android con paquete **`com.archai.mobile`**, exactamente igual al de `app.json`.
5. Descargar `google-services.json` y colocarlo en `mobile/google-services.json`. Alternativamente, usar una variable EAS de tipo archivo `GOOGLE_SERVICES_JSON` apuntando a ese archivo.
6. Configurar en las credenciales del proyecto Expo la cuenta de servicio **FCM v1** del mismo proyecto Firebase, por el panel de Expo o `npx eas-cli@latest credentials -p android`. No colocar la clave de cuenta de servicio en el repositorio ni dentro de la app.
7. Crear una APK de desarrollo: `npx eas-cli@latest build --platform android --profile development`. Instalarla en el teléfono y usar `npx expo start --dev-client`.
8. Para una APK con JavaScript empaquetado y sin Metro: `npx eas-cli@latest build --platform android --profile preview`. Configurar la URL accesible del backend para ese entorno de compilación.
9. Iniciar sesión en ArchAI, abrir Ajustes y habilitar notificaciones. Aceptar el permiso Android y comprobar una propuesta desde la web con la app en segundo plano y cerrada.

El cliente está vinculado a `@manuwfs-team/archai-mobile`. Los perfiles `development` y `preview` permiten HTTP para pruebas en la red local; `production` conserva HTTPS. La URL puede cambiarse desde Ajustes sin recompilar, tanto para la IP de la laptop como para un servidor remoto HTTPS que admita WebSocket. Cambiar la URL no publica el servidor: esa dirección debe ser accesible desde el teléfono.

EAS usa la configuración pública de su entorno de compilación. Configurar `EXPO_PUBLIC_ARCHAI_API_URL` para el entorno elegido; el `.env` de la laptop no se sube. El archivo `.easignore` de la raíz envía el cliente móvil y su configuración Firebase a EAS, y excluye backend, frontend, archivos `.env`, cuentas de servicio y claves de firma. `google-services.json` sigue excluido de Git.

El cliente obtiene un token Expo y lo registra en Spring Boot con la identidad autenticada. El backend envía por Expo Push/FCM; solo necesita `EXPO_ACCESS_TOKEN` si el proyecto Expo exige esa protección adicional. La configuración y las claves de Gemini/Claude permanecen en el backend.

Los archivos privados están ignorados por Git. Antes de compartir, comprobar `git status`; no subir `.env`, credenciales FCM, `google-services.json` ni archivos de firma Android.

## Pantallas y conexión

- Salas muestra proyectos de la cuenta y resuelve su diagrama y sala reales.
- El visor soporta paneo/zoom, búsqueda, clases, relaciones y propuestas. Las eliminaciones se distinguen y pueden inspeccionarse antes de su aprobación web.
- Chat comparte mensajes humanos y de IA, muestra proveedor/modelo y permite reintentar o cancelar consultas propias.
- Actividad muestra propuestas, decisiones, menciones, generaciones y cambios relevantes; al tocar una novedad abre la sala correspondiente.
- La caché se separa por usuario y sala. Las consultas IA pendientes de conexión necesitan reintento explícito.
- Cerrar sesión desactiva el registro push y limpia la sesión autenticada. Un cambio de cuenta no reutiliza el historial privado de la anterior.

La implementación nativa reemplaza la referencia histórica a PWA/Web Push VAPID del documento. Se mantiene React Native por acuerdo del equipo.

## Verificación técnica

```powershell
npx expo install --check
npx tsc --noEmit
npx expo export --platform android --output-dir .expo/export-test
```

Estas comprobaciones validan TypeScript y el paquete Android. La recepción física de push, los permisos del teléfono y la configuración Firebase/EAS requieren una prueba en el dispositivo. Ver [las pruebas del equipo](../PRUEBAS-MANUALES.md).

El proyecto usa el TypeScript compatible con Expo SDK 58; `tsconfig.json` hereda las bibliotecas de `expo/tsconfig.base`.
La navegación usa React Navigation 7, compatible con la línea 4 de `react-native-screens`. No reinstalar la familia 6 del cliente anterior.
