# 📱 ArchAI Mobile — Cliente Oficial React Native (Modo Viaje)

Aplicación móvil oficial en **React Native / Expo** para la plataforma **ArchAI Studio** (INF422 / PUDS Ciclo 2).

Diseñada específicamente para el **Desarrollador en Móvil (Actor A4)**, permitiendo supervisar en tiempo real los diagramas de clases UML 2.5, consultar las intervenciones del Agente IA Co-Developer (@ArchAI), participar en el chat técnico y recibir notificaciones push en segundo plano mediante **Web Push VAPID**.

---

## 🏛️ Estructura del Proyecto

```text
ArchAI-App/mobile/
├── App.tsx                     # Entry point y Stack Navigator
├── app.json                    # Configuración de Expo y permisos móviles
├── package.json                # Dependencias React Native, Navigation, STOMP y SVG
├── tsconfig.json               # Configuración TypeScript estricta
├── babel.config.js             # Configuración Babel
└── src/
    ├── api/
    │   ├── client.ts           # Cliente HTTP REST hacia Spring Boot (/api/v1)
    │   └── stompClient.ts      # Cliente WebSocket STOMP (modo escucha pasiva a 60 FPS)
    ├── components/
    │   ├── BottomSheetModal.tsx# Hoja modal deslizante para inspeccionar clases UML
    │   ├── GhostDraftBanner.tsx# Tarjeta flotante para propuestas de IA
    │   └── GlassCard.tsx       # Contenedor visual Glassmorphism oscuro
    ├── screens/
    │   ├── LoginScreen.tsx     # Acceso de desarrollador móvil
    │   ├── RoomsScreen.tsx     # Selector e ingreso por código de sala (ARC-######)
    │   ├── CanvasViewerScreen.tsx # Lienzo interactivo en MODO VIAJE (Solo Lectura)
    │   ├── ChatScreen.tsx      # Chat técnico con el equipo y consulta a @ArchAI
    │   └── SettingsScreen.tsx  # Configuración de IP del backend y alertas push
    ├── theme/
    │   └── colors.ts           # Paleta oficial ArchAI Glassmorphism
    └── types/
        └── uml.ts              # Modelos TypeScript (UmlClass, GhostDraft, CollabMessage)
```

---

## 🚀 Puesta en Marcha

### 1. Instalar dependencias
```bash
cd "C:\Users\HP\Documents\Tarea U\Software\ArchAI\ArchAI-App\mobile"
npm install
```

### 2. Iniciar el servidor de desarrollo Expo
```bash
npm start
# O directamente para Android / iOS:
npm run android
npm run ios
```

### 3. Conexión con el Backend Spring Boot
* **En emulador Android:** La URL por defecto es `http://10.0.2.2:8000/api/v1`.
* **En dispositivo físico (Expo Go en tu celular):** Abre **Ajustes de Conexión** dentro de la app e ingresa la IP local de tu computadora en la red Wi-Fi (ej. `http://192.168.1.50:8000/api/v1`).
