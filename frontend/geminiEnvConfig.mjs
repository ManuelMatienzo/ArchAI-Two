import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

// Only explicitly public VITE variables may enter the client bundle.
export function geminiEnvConfig(mode) {
  const root = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), 'VITE_');
  const frontend = loadEnv(mode, fileURLToPath(new URL('./', import.meta.url)), 'VITE_');
  const names = ['VITE_GEMINI_API_KEY', 'VITE_GEMINI_MODEL'];
  return Object.fromEntries(names.map(name => [
    `import.meta.env.${name}`,
    JSON.stringify(frontend[name] || root[name] || '')
  ]));
}
