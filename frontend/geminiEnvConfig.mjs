// Provider credentials are server-only, including when an old VITE key remains in a local file.
export function geminiEnvConfig(_mode){return {'import.meta.env.VITE_GEMINI_API_KEY':'""','import.meta.env.VITE_ANTHROPIC_API_KEY':'""'};}
