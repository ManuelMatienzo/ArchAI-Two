/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dirección pública de Spring Boot. Las claves de IA permanecen en el backend. */
  readonly VITE_ARCHAI_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}