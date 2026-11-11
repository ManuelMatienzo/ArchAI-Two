import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { geminiEnvConfig } from './geminiEnvConfig.mjs'

export default defineConfig(({ mode }) => ({
  envPrefix: ['VITE_ARCHAI_'],
  define: geminiEnvConfig(mode),
  plugins: [
    react(),
    // Certificado local de confianza que también cubre el host de presentación
    mkcert({ hosts: ['main.d2nlfe2rkbsyt.amplifyapp.com'] })
  ],
  server: {
    host: true,
    port: 443,
    open: true,
    allowedHosts: [
      'main.d2nlfe2rkbsyt.amplifyapp.com',
      '.amplifyapp.com',
      'localhost'
    ],
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        // Ollama rechaza con 403 (CORS) los orígenes que no sean localhost.
        // Vite NO soporta onProxyReq en la config: hay que usar el hook
        // `configure` para tocar la instancia del proxy y quitar Origin/Referer.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        }
      }
    }
  }
}))
