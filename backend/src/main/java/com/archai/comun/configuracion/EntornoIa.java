package com.archai.comun.configuracion;

import java.nio.file.*;
import java.io.IOException;
import java.util.Set;

/** Solo secretos de IA: nunca importa configuración de base de datos en local-test. */
public final class EntornoIa {
    private EntornoIa() {}
    private static final Set<String> KEYS=Set.of("GEMINI_API_KEY","GEMINI_MODEL","ANTHROPIC_API_KEY","ANTHROPIC_MODEL","ANTHROPIC_WORKSPACE_ID","ARCHAI_CLAUDE_FALLBACK_ENABLED","ARCHAI_AI_TEST_CONTROLS");
    public static void cargar() {
        for(String name:new String[]{"backend/.env.local",".env.local",".env","../.env"}) {
            Path path=Path.of(name);
            if(!Files.isRegularFile(path)) continue;
            try {
                for(String line:Files.readAllLines(path)) {
                    String[] parts=line.strip().split("=",2);
                    if(parts.length!=2) continue;
                    String key=parts[0].strip(), value=parts[1].strip();
                    if(!KEYS.contains(key) || System.getProperty(key)!=null || System.getenv(key)!=null) continue;
                    if(value.length()>1 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) value=value.substring(1,value.length()-1);
                    System.setProperty(key,value);
                }
            } catch(IOException ex) { throw new IllegalStateException("No se pudo leer la configuración privada de IA."); }
        }
    }
}
