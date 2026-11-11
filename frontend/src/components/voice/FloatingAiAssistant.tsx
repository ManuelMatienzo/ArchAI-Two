import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Plus, 
  X,
  Cpu,
  ShieldCheck,
  Wrench,
  RotateCcw,
  Minimize2,
  Maximize2,
  Bot,
  Zap,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Pencil,
  ShoppingCart,
  HeartPulse,
  GraduationCap,
  Package
} from 'lucide-react';
import { ClaseUml, AtributoUml, RelacionUml, MetodoUml, ModeloDiagrama } from '../../types/uml';
import { parseNaturalLanguageCommand } from '../../services/aiVoiceParser';
import { analizarComandoVoz, generarDiagramaConPrompt, auditarMadurezBackend } from '../../services/api';
import { auditarCodigoProyecto, generarMetodosSugeridos } from '../../services/projectBrainService';
import { instanciarPlantilla, PLANTILLAS_DISPONIBLES } from '../../services/plantillasDominio';
import { verificarEstadoOllama, generarRespuestaOllama } from '../../services/ollamaService';
import { generarDiagramaConAgente, modificarDiagramaConAgente, fusionarDiagramas, normalizarDiagrama } from '../../services/agenteDiagrama';
import { inferirTablaIntermedia, inferirDireccionMaestroTransaccion, sanitizarDiagramaUML25 } from '../../services/semanticDomainEngine';
import { geminiDisponible, verificarEstadoGemini, generarRespuestaGemini, MODELO_GEMINI } from '../../services/geminiService';

interface FloatingAiAssistantProps {
  existingClasses: ClaseUml[];
  diagram?: ModeloDiagrama;
  customFiles?: Record<string, string>;
  onAddClass: (newClass: ClaseUml) => void;
  onAddAttribute: (classId: string, attr: AtributoUml) => void;
  onAddMethod?: (classId: string, method: MetodoUml) => void;
  onAddRelation: (relation: RelacionUml) => void;
  /** Reemplaza el diagrama completo del lienzo (para modificaciones del agente). */
  onUpdateDiagram?: (diagram: ModeloDiagrama) => void;
  onOpenWhiteboard?: () => void;
  onOpenCodeDock?: () => void;
  onClose?: () => void;
}

export interface EstadoDiagnostico {
  saludScore: number;
  nivel: string;
  resumen: string;
  alertas: string[];
  fortalezas: string[];
  sugerencias: string[];
  metodosSugeridos: Record<string, MetodoUml[]>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  tipoAccion?: 'GREETING' | 'AUDIT' | 'AUTO_FIX' | 'CREATE_CLASS' | 'DOMAIN' | 'INFO' | 'ERROR';
  diagnostico?: EstadoDiagnostico;
}

// Neutralizar de forma permanente y absoluta cualquier síntesis de voz en el navegador
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak = () => {};
  } catch {
    /* ignore */
  }
}

export const FloatingAiAssistant: React.FC<FloatingAiAssistantProps> = ({
  existingClasses,
  diagram,
  customFiles,
  onAddClass,
  onAddAttribute,
  onAddMethod,
  onAddRelation,
  onUpdateDiagram,
  onOpenWhiteboard,
  onOpenCodeDock,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-init',
      sender: 'ai',
      text: '¡Hola! Soy tu copiloto IA de ArchAI, conectado a la IA en la nube (Gemini) con Ollama local como respaldo. Puedo auditar tu arquitectura, crear entidades y relaciones, inyectar claves PK faltantes o responder tus preguntas sobre modelado de software.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipoAccion: 'GREETING'
    }
  ]);

  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isChatExpanded, setIsChatExpanded] = useState<boolean>(true);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Listo para interactuar.');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [recognitionSupported, setRecognitionSupported] = useState<boolean>(true);
  const [ollamaStatus, setOllamaStatus] = useState<{ activo: boolean; modelo: string | null }>({
    activo: false,
    modelo: null
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const silenceTimerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Asegurar anulación de voz del navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak = () => {};
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Verificar estado de la IA (Gemini en la nube con prioridad o fallback Ollama local)
  useEffect(() => {
    let cancel = false;
    const verificar = async () => {
      if (geminiDisponible()) {
        const estadoGemini = await verificarEstadoGemini();
        if (estadoGemini.online && !cancel) {
          setOllamaStatus({ activo: true, modelo: estadoGemini.model || MODELO_GEMINI });
          return;
        }
      }
      const estado = await verificarEstadoOllama();
      if (!cancel) {
        setOllamaStatus({ activo: estado.online, modelo: estado.model });
      }
    };
    verificar();
    const interval = setInterval(verificar, 8000);
    return () => {
      cancel = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll al final del chat al recibir mensajes o pensar
  useEffect(() => {
    if (isChatExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking, isChatExpanded]);

  // Finalizar escucha y disparar ejecución de la instrucción hablada
  const finalizarYEjecutarVoz = (transcriptForzado?: string) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);

    if (isProcessingRef.current) return;

    const comando = (transcriptForzado || transcriptRef.current || inputText).trim();
    if (comando.length > 0) {
      isProcessingRef.current = true;
      transcriptRef.current = '';
      setInputText('');
      executeCommand(comando).finally(() => {
        isProcessingRef.current = false;
      });
    } else {
      setStatusType('info');
      setStatusMessage('No se detectó voz.');
    }
  };

  // Inicializar Web Speech API con transcripción continua en vivo
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      const langNav = navigator.language;
      rec.lang = langNav && langNav.startsWith('es') ? langNav : 'es-ES';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setStatusType('info');
        setStatusMessage('Escuchando... Habla y verás el texto aquí en el input.');
      };

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + ' ';
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const textoCompleto = (finalTranscript + interimTranscript).trim();
        if (textoCompleto) {
          transcriptRef.current = textoCompleto;
          setInputText(textoCompleto);
          setStatusMessage(`"${textoCompleto}"`);
        }

        // Timer de silencio relajado (3.5s): procesa automáticamente si no se pulsa el botón
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (transcriptRef.current.trim().length > 0 && !isProcessingRef.current) {
            finalizarYEjecutarVoz();
          }
        }, 3500);
      };

      rec.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event?.error);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (event?.error === 'not-allowed') {
          setIsListening(false);
          setStatusType('error');
          setStatusMessage('Permiso de micrófono denegado en el navegador.');
        } else if (event?.error === 'no-speech') {
          if (transcriptRef.current.trim().length > 0) {
            finalizarYEjecutarVoz();
          } else {
            setIsListening(false);
            setStatusType('info');
            setStatusMessage('No se escuchó audio. Haz clic en el micrófono para hablar.');
          }
        } else {
          if (transcriptRef.current.trim().length > 0) {
            finalizarYEjecutarVoz();
          } else {
            setIsListening(false);
            setStatusType('error');
            setStatusMessage('Error de captura de voz.');
          }
        }
      };

      rec.onend = () => {
        if (isListening && !isProcessingRef.current && transcriptRef.current.trim().length > 0) {
          finalizarYEjecutarVoz();
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
    } else {
      setRecognitionSupported(false);
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleToggleListening = () => {
    if (!recognitionSupported) {
      setStatusType('error');
      setStatusMessage('Navegador sin soporte de voz nativo. Escribe el comando.');
      return;
    }

    if (isListening) {
      // Al hacer clic en el micrófono mientras graba: se detiene y procesa inmediatamente lo que dijo
      finalizarYEjecutarVoz();
    } else {
      setInputText('');
      transcriptRef.current = '';
      setStatusType('info');
      setStatusMessage('Escuchando... Di tu instrucción y pulsa el micrófono para enviar.');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error al iniciar micrófono:', err);
      }
    }
  };

  const mapearClaseBackend = (c: any): ClaseUml => ({
    id: c.id || `class-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: c.name,
    stereotype: c.stereotype || 'Entity',
    position: c.position || { x: 200 + Math.random() * 200, y: 180 + Math.random() * 150 },
    attributes: (c.attributes || []).map((a: any, idx: number) => ({
      id: a.id || `attr-${Date.now()}-${idx}`,
      name: a.name,
      type: a.type || 'String',
      visibility: a.visibility || '-',
      isPrimaryKey: a.isPrimaryKey ?? (a.name.toLowerCase() === 'id'),
      isNullable: a.isNullable ?? true
    })),
    methods: (c.methods || []).map((m: any, idx: number) => ({
      id: m.id || `m-${Date.now()}-${idx}`,
      name: m.name,
      returnType: m.returnType || 'void',
      visibility: m.visibility || '+',
      parameters: Array.isArray(m.parameters) ? m.parameters.join(', ') : (m.parameters || '')
    }))
  });

  /** Ejecuta el comando interpretado y lo refleja en el flujo de Chat */
  const executeCommand = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: cleanText,
      timestamp: hora
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);
    setStatusType('info');
    setStatusMessage(`Procesando con IA: "${cleanText.slice(0, 30)}..."`);

    // 0. Parsear intención con el motor NLP
    const localResult = parseNaturalLanguageCommand(cleanText, existingClasses);

    // Preparar contexto del modelo UML actual para el LLM
    const contextoUml = existingClasses.length > 0
      ? `El modelo UML actual tiene ${existingClasses.length} clases: ${existingClasses.map(c => c.name).join(', ')}.`
      : 'El modelo UML actual está vacío.';

    // Si el texto pide MODIFICAR/MEJORAR el diagrama que ya está en el lienzo -> AGENTE lector
    const tieneIntencionModificacion = (texto: string): boolean => {
      const t = texto.toLowerCase();
      const palabras = texto.trim().split(/\s+/).length >= 3;
      const esModificacion = /(modifica|modificar|cambia|cambiar|actualiza|actualizar|edita|editar|agrega|agregar|añade|anade|añadir|anadir|quita|quitar|elimina|eliminar|borra|borrar|mejora|mejorar|corrige|corregir|arregla|reestructura|reestructurar|relaciona|renombra|renombrar|incorpora|incorporar|inserta|insertar|pon|poner|añadir)/.test(t);
      const esSobreDiagrama = /(diagrama|modelo|lienzo|clase|clases|entidad|atributo|atributos|método|metodo|metodos|métodos|relacion|relación|uml|campo|campos)/.test(t);
      const esSobreMetodo = /(método|metodo|función|funcion|operacion|operación|calcular|obtener|generar|buscar|guardar|procesar|retorna|retornar|devuelve|devolver|void|return)/.test(t);
      const esSobreTipo = /(tipo de|tipo del|cambiar a|cambiar el tipo|convertir a|string|integer|long|boolean|double|bigdecimal|localdate|localdatetime)/.test(t);
      const esSugerencia = /(sugiere|sugerir|recomienda|recomendacion|recomendación|recomendaciones)/.test(t);
      if (esSugerencia) return esSobreDiagrama && palabras;
      if (esSobreMetodo && palabras) return true;
      if (esSobreTipo && esSobreDiagrama && palabras) return true;
      return esModificacion && palabras;
    };

    // Detectar si es una petición de modificación compleja que merece ir al agente
    // (incluye ADD_ATTRIBUTE de método o cambio de tipo, no solo UNKNOWN)
    const esModificacionCompleja = tieneIntencionModificacion(cleanText) && existingClasses.length > 0;

    if (esModificacionCompleja && (localResult.action === 'UNKNOWN' || localResult.action === 'ADD_ATTRIBUTE')) {
      await modificarDiagramaDesdePromptInterno(cleanText);
      setIsThinking(false);
      return;
    }

    // Si el texto parece un pedido de diagrama libre y Ollama o Gemini está activo -> AGENTE de diagramas
    const pareceSolicitudDiagrama = (texto: string): boolean => {
      const t = texto.toLowerCase();
      const palabras = texto.trim().split(/\s+/).length;
      const esPregunta = /^(qué|que|cómo|como|por qué|porque|cuál|cual|cuáles|cuales|dónde|donde|puedes explicar|me explicas|explícame|explicame|recomiendas|sugieres)/i.test(texto.trim());
      if (esPregunta) return false;
      return palabras >= 3 &&
        (t.includes('sistema') || t.includes('dominio') || t.includes('diagrama') ||
         t.includes('modulo') || t.includes('módulo') || t.includes('aplicacion') || t.includes('aplicación') ||
         t.startsWith('crea') || t.startsWith('crear') || t.startsWith('diseña') || t.startsWith('diseñar') ||
         t.startsWith('hazme') || t.startsWith('quiero un') || t.startsWith('genera') || t.startsWith('generar') ||
         t.includes('necesito un') || t.includes('necesito una'));
    };

    if (localResult.action === 'UNKNOWN' && pareceSolicitudDiagrama(cleanText)) {
      await generarDiagramaDesdePromptInterno(cleanText);
      setIsThinking(false);
      return;
    }

    // Si Gemini o Ollama está activo y es saludo, ayuda, pregunta o desconocido -> consultar el Agente IA
    if ((geminiDisponible() || ollamaStatus.activo) && (localResult.action === 'GREETING' || localResult.action === 'HELP' || localResult.action === 'UNKNOWN')) {
      // 1) Motor Primario: Google Gemini (Cloud)
      if (geminiDisponible()) {
        try {
          const respGemini = await generarRespuestaGemini(cleanText, contextoUml);
          if (respGemini.success && respGemini.text) {
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              sender: 'ai',
              text: respGemini.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              tipoAccion: localResult.action === 'GREETING' ? 'GREETING' : 'INFO'
            }]);
            setIsThinking(false);
            setStatusType('success');
            setStatusMessage('Respuesta generada por Gemini (Cloud).');
            return;
          }
        } catch (err) {
          console.warn('Gemini falló en chat conversacional, intentando fallback Ollama:', err);
        }
      }

      // 2) Motor Secundario: Ollama local (si está activo)
      if (ollamaStatus.activo) {
        try {
          const respuestaOllama = await generarRespuestaOllama(cleanText, ollamaStatus.modelo || undefined, contextoUml);
          if (respuestaOllama.success && respuestaOllama.text) {
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              sender: 'ai',
              text: respuestaOllama.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              tipoAccion: localResult.action === 'GREETING' ? 'GREETING' : 'INFO'
            }]);
            setIsThinking(false);
            setStatusType('success');
            setStatusMessage('Respuesta generada por Ollama.');
            return;
          }
        } catch (err) {
          console.warn('Ollama falló, usando motor heurístico local:', err);
        }
      }
    }

    // Acción: Saludo (Fallback local amigable)
    if (localResult.action === 'GREETING') {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: '¡Hola! Soy tu copiloto IA de ArchAI. Estoy listo para asistirte a diseñar y auditar tu modelo. Puedes pedirme "Auditar modelo", "Auto-corregir", generar un "Sistema de ventas" o "Crear clase Factura".',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'GREETING'
      }]);
      setIsThinking(false);
      setStatusType('success');
      setStatusMessage('Asistente listo.');
      return;
    }

    // Acción: Ayuda y capacidades
    if (localResult.action === 'HELP') {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Comandos que puedes pedirme por texto o voz:\n\n• "Auditar modelo" · Analiza normalización 3FN, llaves PK y huérfanas.\n• "Auto-corregir" · Inyecta automáticamente PKs y métodos faltantes.\n• "Sistema de ventas" · Genera Cliente, Pedido, Detalle, Producto, Factura y Pago.\n• "Sistema de hospital" · Genera Paciente, Médico, Cita, Historial y Receta.\n• "Crear clase <Nombre> con <campos>" · Crea entidades con atributos.\n• "Relaciona <A> con <B> 1 a N" · Conecta entidades con multiplicidad.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      setStatusType('info');
      setStatusMessage('Guía de comandos mostrada.');
      return;
    }

    // Acción: Agradecimiento
    if (localResult.action === 'GRATITUDE') {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: localResult.message || '¡Con gusto! Estoy aquí para ayudarte a diseñar la mejor arquitectura.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      setStatusType('success');
      return;
    }

    // Acción: Auto-reparar modelo
    if (localResult.action === 'AUTO_FIX_MODEL') {
      await ejecutarAutoReparacionInterna();
      setIsThinking(false);
      return;
    }

    // Acción: Auditoría y Madurez del Cerebro de Código
    if (localResult.action === 'VALIDATE_MODEL') {
      await ejecutarAuditoriaCerebroInterna();
      setIsThinking(false);
      return;
    }

    // Acción: Generar Dominio Completo (Plantillas de Negocio)
    if (localResult.action === 'GENERATE_DOMAIN' && localResult.domainId) {
      ejecutarInstanciacionDominioInterna(localResult.domainId);
      setIsThinking(false);
      return;
    }

    // Acción: Abrir Pizarra Física
    if (localResult.action === 'OPEN_WHITEBOARD') {
      onOpenWhiteboard?.();
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Escáner de pizarra física abierto (CU-07). Puedes capturar o cargar un boceto hecho a mano.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      return;
    }

    // Acción: Abrir Panel de Código Spring Boot
    if (localResult.action === 'OPEN_CODE_DOCK') {
      onOpenCodeDock?.();
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Panel de código Spring Boot abierto (CU-10 / CU-14). Aquí puedes ver y descargar entidades, repositorios y DDL SQL.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      return;
    }

    // Acción: Crear Clase Localmente (Respuesta Inmediata)
    const claseCreada = localResult.createdClass;
    if (localResult.action === 'CREATE_CLASS' && claseCreada) {
      onAddClass(claseCreada);
      const attrs = (claseCreada.attributes || []).map(a => `${a.name}: ${a.type}`).join(', ');
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `He creado la clase '${claseCreada.name}' en el lienzo.${attrs ? ` Atributos: [${attrs}]` : ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'CREATE_CLASS'
      }]);
      setIsThinking(false);
      setStatusType('success');
      setStatusMessage(`Clase '${claseCreada.name}' creada.`);
      return;
    }

    // Acción: Agregar Atributo Localmente
    const atributoNuevo = localResult.newAttribute;
    if (localResult.action === 'ADD_ATTRIBUTE' && atributoNuevo) {
      const targetCls = existingClasses.find(c =>
        c.name.toLowerCase() === localResult.targetClassName?.toLowerCase()
      );
      const classId = targetCls ? targetCls.id : (existingClasses[0]?.id || 'cls-1');
      onAddAttribute(classId, atributoNuevo);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Atributo '+${atributoNuevo.name}: ${atributoNuevo.type}' agregado a '${targetCls?.name || 'clase seleccionada'}'.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      setStatusType('success');
      return;
    }

    // Acción: Relacionar Clases Localmente con Ley Asociativa UML 2.5
    const relacionNueva = localResult.newRelation;
    if (localResult.action === 'CREATE_RELATION' && relacionNueva) {
      // 1. Inyectar clases maestras sintetizadas si las hubo
      if (localResult.createdClasses && localResult.createdClasses.length > 0) {
        localResult.createdClasses.forEach(c => {
          if (!existingClasses.some(ec => ec.id === c.id)) {
            onAddClass(c);
          }
        });
      }

      // 2. Inyectar clase asociativa si es nueva
      if (localResult.createdClass && !existingClasses.some(ec => ec.id === localResult.createdClass!.id)) {
        onAddClass(localResult.createdClass);
      }

      // 3. Manejo de relación N:M y Ley Asociativa UML 2.5
      if (relacionNueva.type === 'ASSOCIATION_N_M') {
        const baseClasses = diagram?.classes && diagram.classes.length > 0 ? diagram.classes : existingClasses;
        const todasLasClases: ClaseUml[] = [...baseClasses];

        if (localResult.createdClasses) {
          localResult.createdClasses.forEach(c => {
            if (!todasLasClases.some(tc => tc.id === c.id)) todasLasClases.push(c);
          });
        }
        if (localResult.createdClass && !todasLasClases.some(tc => tc.id === localResult.createdClass!.id)) {
          todasLasClases.push(localResult.createdClass);
        }

        const srcCls = todasLasClases.find(c => c.id === relacionNueva.sourceClassId);
        const tgtCls = todasLasClases.find(c => c.id === relacionNueva.targetClassId);

        let assocId = relacionNueva.associationClassId;
        let assocCls = assocId ? todasLasClases.find(c => c.id === assocId) : undefined;

        // Si no traía associationClassId pre-set, inferir la clase asociativa del dominio
        if (!assocId && srcCls && tgtCls) {
          const suggestion = inferirTablaIntermedia(srcCls, tgtCls, todasLasClases);
          const interId = 'cls-inter-' + Date.now();
          const interClass: ClaseUml = {
            id: interId,
            name: suggestion.nombreClase,
            stereotype: 'AssociationClass',
            attributes: suggestion.atributos.filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false })),
            methods: suggestion.metodos || [],
            position: suggestion.posicion
          };
          todasLasClases.push(interClass);
          assocId = interId;
          assocCls = interClass;
          relacionNueva.associationClassId = interId;
          relacionNueva.label = interClass.name;
        }

        if (assocId) {
          // Purga de cualquier arista binaria previa hacia la clase asociativa (UML 2.5 estricto)
          const baseRelations = diagram?.relations || [];
          const relsFiltradas = baseRelations.filter(r =>
            r.sourceClassId !== assocId && r.targetClassId !== assocId &&
            !((r.sourceClassId === relacionNueva.sourceClassId && r.targetClassId === relacionNueva.targetClassId) ||
              (r.sourceClassId === relacionNueva.targetClassId && r.targetClassId === relacionNueva.sourceClassId))
          );
          const relsConsolidadas = [...relsFiltradas, relacionNueva];

          const sanitized = sanitizarDiagramaUML25({
            title: diagram?.title || 'Diagrama UML',
            classes: todasLasClases,
            relations: relsConsolidadas,
            updatedAt: new Date().toISOString()
          });

          if (onUpdateDiagram) {
            onUpdateDiagram(sanitized);
          } else {
            if (assocCls && !existingClasses.some(ec => ec.id === assocCls!.id)) {
              onAddClass(assocCls);
            }
            onAddRelation(relacionNueva);
          }

          const nombreAssoc = assocCls?.name || relacionNueva.label || 'Intermedia';
          setMessages(prev => [...prev, {
            id: 'ai-' + Date.now(),
            sender: 'ai',
            text: 'En cumplimiento estricto de la Ley Asociativa UML 2.5 y 3FN, la relación N:M entre \'' + (srcCls?.name || 'Origen') + '\' y \'' + (tgtCls?.name || 'Destino') + '\' fue vinculada a la clase asociativa \'' + nombreAssoc + '\' con su conector en "T" perpendicular (sin relaciones binarias directas redundantes).',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'INFO'
          }]);
          setIsThinking(false);
          setStatusType('success');
          setStatusMessage('Ley asociativa UML 2.5 aplicada con ' + nombreAssoc + '.');
          return;
        }
      }

      // 4. Si es 1:N, verificar dirección Maestro (1) -> Transacción (*)
      if (relacionNueva.type === 'ASSOCIATION_1_N') {
        const srcCls = existingClasses.find(c => c.id === relacionNueva.sourceClassId);
        const tgtCls = existingClasses.find(c => c.id === relacionNueva.targetClassId);
        if (srcCls && tgtCls) {
          const dir = inferirDireccionMaestroTransaccion(srcCls.name, tgtCls.name);
          if (!dir.origenEsMaestro) {
            relacionNueva.sourceClassId = tgtCls.id;
            relacionNueva.targetClassId = srcCls.id;
          }
        }
      }

      onAddRelation(relacionNueva);
      setMessages(prev => [...prev, {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: 'Relación creada (' + (relacionNueva.label || relacionNueva.type) + ') en el lienzo.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      setIsThinking(false);
      setStatusType('success');
      return;
    }

    // Acción: Generar Diagrama desde Prompt Libre
    if (localResult.action === 'GENERATE_DIAGRAM' && localResult.rawPrompt) {
      await generarDiagramaDesdePromptInterno(localResult.rawPrompt);
      setIsThinking(false);
      return;
    }

    // Fallback: Intentar con el servicio del backend Spring Boot
    try {
      const response = await analizarComandoVoz(cleanText);
      if (response && response.success) {
        if (response.action === 'CREATE_CLASS' && response.createdClass) {
          const nuevaClase = mapearClaseBackend(response.createdClass);
          onAddClass(nuevaClase);
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Clase '${nuevaClase.name}' creada por la IA en el lienzo.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'CREATE_CLASS'
          }]);
        } else if (response.action === 'ADD_ATTRIBUTE' && response.createdAttribute) {
          const target = existingClasses.find(c =>
            c.name.toLowerCase() === (response.targetClassName || '').toLowerCase()
          );
          const classId = target ? target.id : (existingClasses[0]?.id || 'cls-1');
          onAddAttribute(classId, response.createdAttribute);
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Atributo '+${response.createdAttribute.name}: ${response.createdAttribute.type}' añadido por la IA.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'INFO'
          }]);
        } else if (response.action === 'ADD_RELATION' && response.createdRelation) {
          onAddRelation(response.createdRelation);
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: 'Relación conectada por la IA en el diagrama.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'INFO'
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: response.message || 'Comando ejecutado con éxito.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'INFO'
          }]);
        }
        setIsThinking(false);
        setStatusType('success');
        return;
      }
    } catch {
      // Backend no disponible, usar fallback
    }

    // Fallback final: Crear una entidad inteligente basada en las palabras
    const words = cleanText.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const candidateName = words[words.length - 1].charAt(0).toUpperCase() + words[words.length - 1].slice(1);
      const fallbackClass: ClaseUml = {
        id: 'class-' + Date.now(),
        name: candidateName,
        stereotype: 'Entity',
        position: { x: 140 + (existingClasses.length % 3) * 340, y: 140 + Math.floor(existingClasses.length / 3) * 280 },
        attributes: [
          { id: `attr-${Date.now()}-id`, name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true, isNullable: false },
          { id: `attr-${Date.now()}-1`, name: 'nombre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
          { id: `attr-${Date.now()}-2`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
        ],
        methods: [
          { id: `m-${Date.now()}-1`, name: `get${candidateName}Info`, returnType: 'String', visibility: '+', parameters: '' }
        ]
      };
      onAddClass(fallbackClass);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Entidad '${candidateName}' generada automáticamente con clave primaria PK y métodos.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'CREATE_CLASS'
      }]);
      setStatusType('success');
      setStatusMessage(`Entidad '${candidateName}' creada.`);
    } else {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'No logré interpretar esa instrucción. Prueba diciendo: "Crear clase Factura", "Auditar modelo", "Auto-corregir" o "Sistema de ventas".',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
      setStatusType('error');
    }
    setIsThinking(false);
  };

  /** Instanciación instantánea de Dominios de Negocio Completos */
  const ejecutarInstanciacionDominioInterna = (dominioId: string) => {
    const instancia = instanciarPlantilla(dominioId, diagram);
    if (!instancia) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `No se encontró la plantilla de negocio '${dominioId}'.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
      return;
    }

    const sanitized = sanitizarDiagramaUML25({
      title: diagram?.title || 'Dominio ' + dominioId,
      classes: instancia.classes,
      relations: instancia.relations,
      updatedAt: new Date().toISOString()
    });

    if (onUpdateDiagram) {
      onUpdateDiagram(sanitized);
    } else {
      sanitized.classes.forEach(c => onAddClass(c));
      sanitized.relations.forEach(r => onAddRelation(r));
    }

    const plantilla = PLANTILLAS_DISPONIBLES.find(p => p.id === dominioId);
    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: `Arquitectura de '${plantilla?.nombre || dominioId}' generada en el lienzo: ${instancia.classes.length} clases y ${instancia.relations.length} relaciones listas con normalización 3FN.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipoAccion: 'DOMAIN'
    }]);
    setStatusType('success');
    setStatusMessage(`Plantilla '${plantilla?.nombre || dominioId}' generada.`);
  };

  /** Auditoría inteligente del Cerebro de Código (AST + madurez + persistencia) */
  const ejecutarAuditoriaCerebroInterna = async () => {
    setStatusType('info');
    setStatusMessage('Auditando modelo arquitectónico y código del proyecto...');
    try {
      const modelo: ModeloDiagrama = diagram || {
        title: 'Proyecto ArchAI',
        classes: existingClasses,
        relations: [],
        updatedAt: new Date().toISOString()
      };
      const diagnosticoLocal = auditarCodigoProyecto(modelo, customFiles);

      let backendAlertas: string[] = [];
      try {
        const backendRes = await auditarMadurezBackend(modelo);
        if (backendRes?.alertasArquitectura?.length) {
          backendAlertas = backendRes.alertasArquitectura;
        }
      } catch {
        /* Fallback al análisis local */
      }

      const todasAlertas = Array.from(new Set([...diagnosticoLocal.alertasCriticas, ...backendAlertas]));
      const diag: EstadoDiagnostico = {
        saludScore: diagnosticoLocal.saludGlobal,
        nivel: diagnosticoLocal.nivel,
        resumen: `${diagnosticoLocal.clasesAnalizadas} clase(s) analizadas · ${diagnosticoLocal.metodosSugeridosTotales} método(s) de dominio recomendados.`,
        alertas: todasAlertas,
        fortalezas: diagnosticoLocal.fortalezas,
        sugerencias: [
          ...diagnosticoLocal.sugerenciasInmediatas,
          ...diagnosticoLocal.sugerenciasAccion
        ],
        metodosSugeridos: diagnosticoLocal.metodosSugeridosPorClase
      };

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Auditoría completada: Madurez arquitectónica del ${diag.saludScore}% (${diag.nivel.toUpperCase()}). ${diag.alertas.length > 0 ? `Se encontraron ${diag.alertas.length} aspectos por optimizar:` : '¡Todas las entidades cumplen las reglas de integridad 3FN!' }`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'AUDIT',
        diagnostico: diag
      }]);

      setStatusType('success');
      setStatusMessage(`Auditoría: ${diag.saludScore}% de madurez.`);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Error al auditar: ${err?.message || 'Error desconocido'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
    }
  };

  /** Auto-reparación inteligente con IA: inyecta PKs faltantes y métodos de dominio */
  const ejecutarAutoReparacionInterna = async () => {
    setStatusType('info');
    setStatusMessage('Auto-corrigiendo claves primarias y métodos en el modelo...');

    let pksAgregadas = 0;
    let metodosAgregados = 0;

    existingClasses.forEach(cls => {
      // 1. Verificar si tiene PK (las clases asociativas en UML no llevan id artificial)
      const esAsociativa = cls.stereotype === 'AssociationClass' 
        || String(cls.stereotype || '').toLowerCase().includes('association')
        || (diagram?.relations || []).some(r => r.associationClassId === cls.id);
      const tienePk = (cls.attributes || []).some(a => a.isPrimaryKey || a.name.toLowerCase() === 'id');
      if (!tienePk && !esAsociativa) {
        const nuevaPk: AtributoUml = {
          id: `attr-pk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: 'id',
          type: 'Long',
          visibility: '-',
          isPrimaryKey: true,
          isNullable: false
        };
        onAddAttribute(cls.id, nuevaPk);
        pksAgregadas++;
      }

      // 2. Si no tiene métodos, sugerir e inyectar métodos de dominio (las clases asociativas solo contienen atributos de relación)
      if (!esAsociativa && (cls.methods || []).length === 0) {
        const sugeridos = generarMetodosSugeridos(cls.name);
        sugeridos.forEach(m => {
          if (onAddMethod) {
            onAddMethod(cls.id, m);
            metodosAgregados++;
          }
        });
      }
    });

    const textoResultado = pksAgregadas > 0 || metodosAgregados > 0
      ? `Auto-corrección finalizada: Se inyectaron ${pksAgregadas} clave(s) primaria(s) PK y ${metodosAgregados} método(s) de dominio. El modelo ahora cumple con 3FN y reglas de persistencia Spring Data JPA.`
      : 'El modelo ya se encuentra óptimo: todas las entidades cuentan con identificadores PK y métodos estructurados.';

    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: textoResultado,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipoAccion: 'AUTO_FIX'
    }]);

    setStatusType('success');
    setStatusMessage('Auto-corrección completada.');
  };

  /** CU-04b · El AGENTE lee el diagrama del lienzo y lo modifica/mejora según el pedido */
  const modificarDiagramaDesdePromptInterno = async (prompt: string) => {
    if (!diagram) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'No hay diagrama cargado en el lienzo para modificar. Primero genera uno (ej. "crea un sistema de ventas con cliente, pedido y factura").',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
      setStatusType('error');
      setStatusMessage('No hay diagrama que modificar.');
      return;
    }

    setStatusType('info');
    setStatusMessage('Agente IA leyendo el diagrama del lienzo...');

    try {
      const resultado = await modificarDiagramaConAgente(prompt, diagram);
      if (resultado.success && resultado.diagrama) {
        const nuevo = fusionarDiagramas(resultado.diagrama, diagram);
        onUpdateDiagram?.(nuevo);
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: `El agente (${resultado.model || 'Ollama'}) aplicó tu pedido al diagrama: ${nuevo.classes.length} clases y ${nuevo.relations.length} relaciones en el lienzo.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tipoAccion: 'DOMAIN'
        }]);
        setStatusType('success');
        setStatusMessage('Diagrama actualizado por el agente.');
        return;
      }
      throw new Error(resultado.error || 'Sin resultado del agente');
    } catch (err: any) {
      console.warn('Agente modificador falló:', err);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `No pude modificar el diagrama (${err?.message || 'error del agente'}). Inténtalo de nuevo con otra instrucción, por ejemplo: "agrega una clase Pago con monto BigDecimal" o "relaciona Cliente con Factura como composición".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
      setStatusType('error');
      setStatusMessage('El agente no pudo modificar el diagrama.');
    }
  };

  /** CU-04 · Generación de diagramas completos desde prompt libre (Agente Ollama JSON + fallback backend) */
  const generarDiagramaDesdePromptInterno = async (prompt: string) => {
    setStatusType('info');
    setStatusMessage('Agente IA analizando y dibujando la arquitectura...');

    // 1) AGENTE: Ollama local o Gemini devuelven el diagrama completo en JSON estructurado
    if (ollamaStatus.activo || geminiDisponible()) {
      try {
        const resultado = await generarDiagramaConAgente(prompt, existingClasses);
        if (resultado.success && resultado.diagrama) {
          const { classes, relations } = resultado.diagrama;
          const sanitized = sanitizarDiagramaUML25({
            title: diagram?.title || 'Diagrama Generado por IA',
            classes,
            relations,
            updatedAt: new Date().toISOString()
          });

          if (onUpdateDiagram) {
            onUpdateDiagram(sanitized);
          } else {
            sanitized.classes.forEach((c: ClaseUml) => onAddClass(c));
            sanitized.relations.forEach((r: RelacionUml) => onAddRelation(r));
          }

          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: `Diagrama generado por el agente (${resultado.model || 'Ollama'}): ${sanitized.classes.length} clase(s) y ${sanitized.relations.length} relación(es) añadidas al lienzo (UML 2.5).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tipoAccion: 'DOMAIN'
          }]);
          setStatusType('success');
          setStatusMessage(`Agente: ${sanitized.classes.length} clases y ${sanitized.relations.length} relaciones.`);
          return;
        }
      } catch (err: any) {
        console.warn('Agente IA falló, usando backend:', err);
      }
    }

    // 2) FALLBACK: servicio backend Spring Boot (si está disponible)
    try {
      const dto = await generarDiagramaConPrompt(prompt, 'Diagrama sintetizado por IA');
      const rawClases = dto?.classes || [];
      const rawRelaciones = dto?.relations || [];

      // Aplicar normalización universal por defecto a la respuesta del backend
      const normalizado = normalizarDiagrama({
        className: dto?.name || 'Diagrama',
        classes: rawClases.map((c: any) => mapearClaseBackend(c)),
        relations: rawRelaciones.map((r: any) => ({
          sourceName: rawClases.find((c: any) => c.id === r.sourceClassId)?.name || r.sourceClassId,
          targetName: rawClases.find((c: any) => c.id === r.targetClassId)?.name || r.targetClassId,
          type: r.type,
          label: r.label
        }))
      }, existingClasses);

      const clasesFinales = normalizado?.classes || rawClases.map((c: any) => mapearClaseBackend(c));
      const relacionesFinales = normalizado?.relations || rawRelaciones;

      const sanitizedBackend = sanitizarDiagramaUML25({
        title: diagram?.title || 'Diagrama Generado por IA',
        classes: clasesFinales,
        relations: relacionesFinales,
        updatedAt: new Date().toISOString()
      });

      if (onUpdateDiagram) {
        onUpdateDiagram(sanitizedBackend);
      } else {
        sanitizedBackend.classes.forEach((c: any) => onAddClass(c));
        sanitizedBackend.relations.forEach((r: any) => onAddRelation(r));
      }

      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `Diagrama generado con éxito: ${clasesFinales.length} clase(s) y ${relacionesFinales.length} relación(es) normalizadas en UML 2.5 y añadidas al lienzo.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: `No pude generar el diagrama. Inténtalo de nuevo describiendo el sistema de forma concisa, por ejemplo: "sistema de ventas con cliente, pedido, producto y factura". Detalle: ${err?.message || 'Error desconocido'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'ERROR'
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(inputText);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    executeCommand(prompt);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'ai',
        text: 'Historial reiniciado. ¿Qué deseas diseñar, auditar o consultar hoy en ArchAI?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'GREETING'
      }
    ]);
  };

  /** Muestra en el chat la estructura completa del diagrama actual (clases, atributos, métodos) */
  const mostrarDiagramaEnChat = () => {
    const clases = diagram?.classes || existingClasses;
    if (!clases || clases.length === 0) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'El lienzo está vacío. Aún no hay clases en el diagrama. Prueba: "crea un sistema de ventas con cliente, pedido y factura".',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      return;
    }

    const lineas: string[] = [`Estructura actual del diagrama (${clases.length} clase(s)):\n`];

    clases.forEach((c, i) => {
      lineas.push(`${i + 1}. ${c.name} [${c.stereotype || 'Entity'}]`);

      const attrs = c.attributes || [];
      if (attrs.length > 0) {
        lineas.push(`   Atributos:`);
        attrs.forEach(a => {
          const pk = a.isPrimaryKey ? ' [PK]' : '';
          lineas.push(`      • ${a.visibility || '-'}${a.name}: ${a.type}${pk}`);
        });
      } else {
        lineas.push(`   Atributos: (ninguno)`);
      }

      const methods = c.methods || [];
      if (methods.length > 0) {
        lineas.push(`   Métodos:`);
        methods.forEach(m => {
          const params = m.parameters ? `(${m.parameters})` : '()';
          lineas.push(`      • ${m.visibility || '+'}${m.name}${params}: ${m.returnType}`);
        });
      } else {
        lineas.push(`   Métodos: (ninguno)`);
      }
      lineas.push('');
    });

    const rels = diagram?.relations || [];
    if (rels.length > 0) {
      lineas.push(`Relaciones (${rels.length}):`);
      rels.forEach(r => {
        const src = clases.find(c => c.id === r.sourceClassId)?.name || r.sourceClassId;
        const tgt = clases.find(c => c.id === r.targetClassId)?.name || r.targetClassId;
        const assoc = r.associationClassId ? clases.find(c => c.id === r.associationClassId)?.name : undefined;
        const assocStr = assoc ? ` ┰ [Clase Asociativa en T: "${assoc}"]` : '';
        lineas.push(`   • ${src} ──(${r.type.replace(/_/g, ' ')})──▶ ${tgt}${r.label ? ` "${r.label}"` : ''}${assocStr}`);
      });
      lineas.push('');
    }

    lineas.push(`Para modificar escribe tu instrucción y usa el botón Modificar, por ejemplo:\n• "agrégale el método calcularTotal() a Factura"\n• "cambia el tipo de precio a BigDecimal en Producto"\n• "añade el atributo email String a Cliente"\n• "elimina la clase RepositorioTemporal"`);

    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: lineas.join('\n'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      tipoAccion: 'INFO'
    }]);
  };

  /** Invoca directamente el agente Ollama de modificación con el texto del input */
  const handleModificarConAgente = async () => {
    const prompt = inputText.trim();
    if (!prompt) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: 'Escribe en el campo de texto qué quieres modificar y luego presiona "Modificar". Ejemplos:\n• "agrégale el campo email String a Cliente"\n• "añade método calcularDescuento() a Pedido"\n• "cambia el tipo de total a BigDecimal en Factura"',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tipoAccion: 'INFO'
      }]);
      return;
    }
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: prompt, timestamp: hora }]);
    setInputText('');
    setIsThinking(true);
    await modificarDiagramaDesdePromptInterno(prompt);
    setIsThinking(false);
  };

  return (
    <div
      className={`floating-ai-assistant ${isChatExpanded ? 'chat-expanded' : ''}`}
      style={{
        boxShadow: isListening ? '0 0 30px rgba(16, 185, 129, 0.40), var(--glass-ai-shadow)' : 'var(--glass-ai-shadow)',
        borderColor: isListening ? 'var(--accent-emerald)' : 'var(--glass-ai-border)'
      }}
    >
      {/* 1. Encabezado del Chat */}
      <div className="ai-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: isListening
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(232, 195, 158, 0.4))'
                : 'var(--glass-ai-icon-bg)',
              border: isListening ? '1px solid var(--accent-emerald)' : '1px solid var(--glass-ai-icon-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isListening ? 'var(--accent-emerald)' : 'var(--glass-ai-icon-color)'
            }}
          >
            {isListening ? <Mic size={16} /> : <Sparkles size={16} />}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.86rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '0.01em'
              }}>
                ArchAI Copilot
              </span>

              {/* Badge de IA (Gemini u Ollama) */}
              <span
                title={ollamaStatus.activo ? `IA activa: ${ollamaStatus.modelo || 'Gemini'}` : 'Motor Heurístico Offline Activo'}
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: ollamaStatus.activo ? 'var(--accent-emerald)' : 'var(--accent-primary)',
                  background: ollamaStatus.activo ? 'rgba(16, 185, 129, 0.12)' : 'var(--glass-ai-icon-bg)',
                  padding: '1px 7px',
                  borderRadius: '6px',
                  border: `1px solid ${ollamaStatus.activo ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-ai-icon-border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Cpu size={10} />
                {ollamaStatus.activo ? (ollamaStatus.modelo?.toLowerCase().includes('gemini') ? 'Gemini (Cloud)' : `Ollama Local (${ollamaStatus.modelo?.replace(':latest', '') || 'qwen'})`) : 'IA Offline'}
              </span>

              <span
                style={{
                  fontSize: '0.68rem',
                  color: statusType === 'error' ? 'var(--accent-rose)' : statusType === 'success' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '180px'
                }}
              >
                {statusMessage}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones de la barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleClearChat}
            className="ai-chat-icon-btn"
            title="Limpiar conversación"
          >
            <RotateCcw size={14} />
          </button>

          <button
            onClick={() => setIsChatExpanded(prev => !prev)}
            className="ai-chat-icon-btn"
            title={isChatExpanded ? "Minimizar a barra flotante" : "Expandir a ventana de chat"}
          >
            {isChatExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="ai-chat-icon-btn"
              title="Cerrar panel de asistente IA"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Área de Mensajes del Chat (Historial Conversacional) */}
      {isChatExpanded && (
        <div className="ai-chat-history">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-chat-row ${msg.sender}`}>
              {msg.sender === 'ai' && (
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    background: 'var(--glass-ai-icon-bg)',
                    border: '1px solid var(--glass-ai-icon-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--glass-ai-icon-color)',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <Bot size={14} />
                </div>
              )}

              <div className={msg.sender === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-ai'}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                {/* Renderizar tarjeta de diagnóstico si viene con la respuesta de auditoría */}
                {msg.diagnostico && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(0, 0, 0, 0.04)',
                      border: '1px solid var(--glass-ai-diag-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={14} color="var(--accent-emerald)" />
                        <span style={{ fontSize: '0.74rem', fontWeight: 800 }}>Salud del Modelo</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '10px',
                          background: msg.diagnostico.saludScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: msg.diagnostico.saludScore >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                          border: `1px solid ${msg.diagnostico.saludScore >= 80 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                        }}
                      >
                        {msg.diagnostico.saludScore}% Madurez · {msg.diagnostico.nivel.toUpperCase()}
                      </span>
                    </div>

                    {/* Alertas */}
                    {msg.diagnostico.alertas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {msg.diagnostico.alertas.map((alerta, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.67rem',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.30)',
                              borderRadius: '5px',
                              padding: '2px 6px',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0 }} />
                            {alerta}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Fortalezas */}
                    {msg.diagnostico.fortalezas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {msg.diagnostico.fortalezas.slice(0, 3).map((fort, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.67rem',
                              background: 'rgba(16, 185, 129, 0.10)',
                              border: '1px solid rgba(16, 185, 129, 0.30)',
                              borderRadius: '5px',
                              padding: '2px 6px',
                              color: 'var(--accent-emerald)'
                            }}
                          >
                            <CheckCircle2 size={12} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                            {fort}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Botón interactivo de auto-corrección */}
                    {msg.diagnostico.alertas.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
                        <button
                          onClick={() => executeCommand('auto-corregir')}
                          style={{
                            background: 'var(--accent-emerald)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Inyectar claves primarias PK y métodos de dominio automáticamente"
                        >
                          <Wrench size={11} />
                          Auto-corregir con IA ahora
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="ai-chat-timestamp">{msg.timestamp}</div>
              </div>
            </div>
          ))}

          {/* Indicador de pensamiento / respuesta en proceso */}
          {isThinking && (
            <div className="ai-chat-row ai">
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'var(--glass-ai-icon-bg)',
                  border: '1px solid var(--glass-ai-icon-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-emerald)',
                  flexShrink: 0
                }}
              >
                <Sparkles size={14} />
              </div>

              <div className="ai-chat-typing-bubble">
                <span>{ollamaStatus.activo ? 'Ollama pensando' : 'ArchAI procesando'}</span>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 3. Chips de Sugerencia Rápida */}
      <div
        className="ai-chips-scroll"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '2px 0',
          flexShrink: 0
        }}
      >
        <button
          onClick={mostrarDiagramaEnChat}
          className="ai-chip-btn ai-chip-btn-view"
          title="Ver clases, atributos y métodos del diagrama actual en el chat"
        >
          <FileText size={12} />
          Ver Diagrama
        </button>

        <button
          onClick={handleModificarConAgente}
          disabled={isThinking}
          className="ai-chip-btn ai-chip-btn-modify"
          title="Modificar el diagrama con el agente IA: escribe tu instrucción y presiona aquí"
        >
          <Pencil size={12} />
          Modificar
        </button>

        <button
          onClick={() => handleQuickPrompt('auditar modelo')}
          className="ai-chip-btn ai-chip-btn-audit"
          title="Auditar código y madurez de todo el proyecto con el Cerebro IA"
        >
          <ShieldCheck size={12} />
          Auditar
        </button>

        <button
          onClick={() => handleQuickPrompt('auto-corregir')}
          className="ai-chip-btn ai-chip-btn-autofix"
          title="Auto-corregir claves primarias faltantes y métodos de dominio con IA"
        >
          <Zap size={12} />
          Auto-corregir
        </button>

        <button
          onClick={() => handleQuickPrompt('sistema de ventas')}
          className="ai-chip-btn"
          title="Generar arquitectura completa de ventas y facturación"
        >
          <ShoppingCart size={11} />
          Ventas
        </button>

        <button
          onClick={() => handleQuickPrompt('sistema de hospital')}
          className="ai-chip-btn"
          title="Generar arquitectura médica completa"
        >
          <HeartPulse size={11} />
          Hospital
        </button>

        <button
          onClick={() => handleQuickPrompt('sistema de universidad')}
          className="ai-chip-btn"
          title="Generar arquitectura universitaria"
        >
          <GraduationCap size={11} />
          Universidad
        </button>

        <button
          onClick={() => handleQuickPrompt('sistema de inventario')}
          className="ai-chip-btn"
          title="Generar arquitectura de almacén e inventario"
        >
          <Package size={11} />
          Inventario
        </button>

        <button
          onClick={() => handleQuickPrompt('Crear clase Pedido con total Double y fecha LocalDate')}
          className="ai-chip-btn"
        >
          <Plus size={11} />
          + Pedido
        </button>

        <button
          onClick={() => handleQuickPrompt('Crear clase Cliente con nombre String y correo String')}
          className="ai-chip-btn"
        >
          <Plus size={11} />
          + Cliente
        </button>

        <button
          onClick={() => handleQuickPrompt('Relaciona Cliente con Pedido 1 a N')}
          className="ai-chip-btn"
        >
          <Plus size={11} />
          Vincular 1:N
        </button>
      </div>

      {/* 4. Barra Inferior de Entrada (Input + Micrófono + Botón Enviar) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isListening ? 'rgba(16, 185, 129, 0.08)' : 'var(--glass-ai-input-bg)',
            borderRadius: '10px',
            padding: '6px 12px',
            border: isListening ? '1px solid var(--accent-emerald)' : '1px solid var(--glass-ai-input-border)',
            transition: 'all 0.2s ease'
          }}
        >
          <input
            type="text"
            placeholder={
              isListening
                ? 'Transcribiendo tu voz en vivo... Clic al micrófono rojo para procesar'
                : 'Escribe a la IA (ej: "hola", "auditar", "sistema de ventas", "crear clase Factura")...'
            }
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              transcriptRef.current = e.target.value;
            }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--glass-ai-input-text)',
              fontSize: '0.84rem',
              fontFamily: 'var(--font-body)'
            }}
          />

          {inputText && !isListening && (
            <button
              onClick={() => executeCommand(inputText)}
              style={{
                background: 'var(--accent-primary)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 9px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Enviar mensaje al chat"
            >
              <Send size={13} />
            </button>
          )}
        </div>

        {/* Botón de Micrófono (Silencioso, pulso visual) */}
        <button
          onClick={handleToggleListening}
          className={`mic-button-glow ${isListening ? 'listening' : ''}`}
          style={{
            background: isListening
              ? 'linear-gradient(135deg, #EF4444, #F43F5E)'
              : 'var(--glass-ai-mic-bg)',
            color: isListening ? '#FFFFFF' : 'var(--glass-ai-mic-color)',
            borderColor: isListening ? '#EF4444' : 'var(--glass-ai-mic-border)',
            boxShadow: isListening ? '0 0 25px rgba(239, 68, 68, 0.6)' : '0 0 10px rgba(0, 0, 0, 0.08)'
          }}
          title={
            isListening
              ? 'Escuchando en vivo... Haz clic para detener y procesar tu instrucción con IA'
              : 'Hablar con la IA (Transcribe en vivo y procesa al hacer clic en el micro)'
          }
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
      </div>
    </div>
  );
};
