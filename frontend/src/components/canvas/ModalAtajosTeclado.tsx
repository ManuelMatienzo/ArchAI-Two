import React from 'react';
import { Keyboard, Sparkles } from 'lucide-react';
import { GlassModal } from '../glass/GlassModal';

interface ModalAtajosTecladoProps {
  onClose: () => void;
}

interface ItemAtajo {
  teclas: string[];
  titulo: string;
  descripcion: string;
}

interface CategoriaAtajo {
  categoria: string;
  items: ItemAtajo[];
}

export const ModalAtajosTeclado: React.FC<ModalAtajosTecladoProps> = ({ onClose }) => {
  const categorias: CategoriaAtajo[] = [
    {
      categoria: 'Guardar y Archivo',
      items: [
        {
          teclas: ['Ctrl', 'K'],
          titulo: 'Búsqueda Rápida Spotlight',
          descripcion: 'Abre la paleta de comandos para buscar clases, atributos, métodos y enfocar el lienzo.'
        },
        {
          teclas: ['Ctrl', 'S'],
          titulo: 'Guardar Diagrama',
          descripcion: 'Guarda en la nube y persistencia local sin abrir el cuadro de diálogo del navegador.'
        }
      ]
    },
    {
      categoria: 'Historial y Edición Rápida',
      items: [
        {
          teclas: ['Ctrl', 'Z'],
          titulo: 'Deshacer (Undo)',
          descripcion: 'Revierte la última acción realizada (adición, edición, eliminación o movimiento).'
        },
        {
          teclas: ['Ctrl', 'Y'],
          titulo: 'Rehacer (Redo)',
          descripcion: 'Restaura la acción deshecha más reciente (también disponible con Ctrl + Shift + Z).'
        },
        {
          teclas: ['Ctrl', 'C'],
          titulo: 'Copiar Clase',
          descripcion: 'Copia al portapapeles la clase seleccionada con todos sus atributos y métodos.'
        },
        {
          teclas: ['Ctrl', 'V'],
          titulo: 'Pegar Clase',
          descripcion: 'Pega un clon de la clase copiada con nuevo identificador único (+40px).'
        },
        {
          teclas: ['Ctrl', 'A'],
          titulo: 'Seleccionar Todo',
          descripcion: 'Selecciona todas las clases del modelo UML simultáneamente para moverlas o alinearlas.'
        },
        {
          teclas: ['Ctrl', 'D'],
          titulo: 'Duplicar Clase',
          descripcion: 'Clona instantáneamente la clase actualmente seleccionada en un solo paso.'
        },
        {
          teclas: ['Supr'],
          titulo: 'Eliminar Selección',
          descripcion: 'Elimina las clases o la relación seleccionada y sus conexiones (o Backspace).'
        }
      ]
    },
    {
      categoria: 'Navegación y Posicionamiento',
      items: [
        {
          teclas: ['Shift', 'Clic'],
          titulo: 'Selección Múltiple',
          descripcion: 'Agrega o quita clases individuales a la selección en grupo.'
        },
        {
          teclas: ['Shift', 'Arrastrar'],
          titulo: 'Selección por Recuadro (Marquee)',
          descripcion: 'Arrastra sobre el lienzo para encerrar y seleccionar múltiples clases a la vez.'
        },
        {
          teclas: ['↑', '↓', '←', '→'],
          titulo: 'Micro-desplazamiento (Nudge)',
          descripcion: 'Mueve las clases seleccionadas 8px alineadas a la cuadrícula.'
        },
        {
          teclas: ['Shift', 'Flechas'],
          titulo: 'Desplazamiento Mayor',
          descripcion: 'Mueve la clase seleccionada 40px en la dirección indicada.'
        },
        {
          teclas: ['Espacio', 'Arrastrar'],
          titulo: 'Paneo Libre del Lienzo',
          descripcion: 'Mantén presionada la barra espaciadora para mover el lienzo estilo Figma/Miro.'
        },
        {
          teclas: ['Esc'],
          titulo: 'Deseleccionar / Cancelar',
          descripcion: 'Cancela la selección activa, el modo de conexión o cierra este modal.'
        }
      ]
    },
    {
      categoria: 'Control de Zoom y Modos de Ratón',
      items: [
        {
          teclas: ['Ctrl', '+'],
          titulo: 'Acercar Zoom',
          descripcion: 'Aumenta la escala de visualización del lienzo (+15%) centrado en la vista.'
        },
        {
          teclas: ['Ctrl', '-'],
          titulo: 'Alejar Zoom',
          descripcion: 'Reduce la escala de visualización del lienzo (-15%) centrado en la vista.'
        },
        {
          teclas: ['Ctrl', '0'],
          titulo: 'Restablecer Zoom',
          descripcion: 'Restablece el zoom al 100% y re-centra la vista en el origen.'
        },
        {
          teclas: ['Rueda', 'Ratón'],
          titulo: 'Zoom o Desplazamiento (Modo Dual)',
          descripcion: 'En modo Zoom (predeterminado), la rueda hace zoom focal sobre el cursor. En modo Desplazamiento, la rueda hace scroll vertical del lienzo.'
        },
        {
          teclas: ['Ctrl', 'Rueda'],
          titulo: 'Zoom Forzado / Trackpad Pinch',
          descripcion: 'Hace zoom continuo focalizado sobre el cursor en cualquiera de los dos modos (ideal para laptops o cuando la rueda está en modo desplazamiento).'
        },
        {
          teclas: ['Shift', 'Rueda'],
          titulo: 'Desplazamiento Horizontal',
          descripcion: 'Desplaza el lienzo lateralmente a la izquierda o derecha usando la rueda del ratón.'
        },
        {
          teclas: ['Alt', 'M'],
          titulo: 'Alternar Modo de Rueda',
          descripcion: 'Cambia al instante el comportamiento de la rueda del ratón entre Zoom directo y Desplazamiento (también disponible con el botón "Rueda" en la barra inferior).'
        }
      ]
    },
    {
      categoria: 'Paneles y Asistentes',
      items: [
        {
          teclas: ['Ctrl', 'B'],
          titulo: 'Dock de Código / DDL',
          descripcion: 'Abre o cierra el panel generador de Spring Boot, PostgreSQL, Postman y XMI.'
        },
        {
          teclas: ['Ctrl', 'K'],
          titulo: 'Asistente de IA Flotante',
          descripcion: 'Alterna el chat del agente Ollama / NLP (también con Ctrl + Espacio).'
        },
        {
          teclas: ['F1'],
          titulo: 'Ver Atajos de Teclado',
          descripcion: 'Abre este panel de ayuda en cualquier momento (o presiona ?).'
        }
      ]
    }
  ];

  const modalFooter = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: '0.76rem',
        color: 'var(--text-muted)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Sparkles size={14} color="#e8c39e" />
        <span>Los atajos se encuentran activos automáticamente en todo el estudio.</span>
      </div>
      <button
        onClick={onClose}
        className="btn-studio-primary"
        style={{
          padding: '6px 18px',
          fontSize: '0.80rem',
          fontWeight: 700
        }}
      >
        Entendido
      </button>
    </div>
  );

  return (
    <GlassModal
      onClose={onClose}
      title="Atajos de Teclado del Estudio ArchAI"
      subtitle="Control total de modelado, edición, navegación y guardado sin tocar el ratón"
      icon={<Keyboard size={20} color="#e8c39e" />}
      iconBg="#2f2c79"
      maxWidth="780px"
      zIndex={1300}
      footer={modalFooter}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {categorias.map(cat => (
          <div key={cat.categoria} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 800,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {cat.categoria}
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.45)',
                border: '1px solid rgba(245, 225, 206, 0.10)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            >
              {cat.items.map((item, idx) => (
                <div
                  key={item.titulo}
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: idx === cat.items.length - 1 ? 'none' : '1px solid rgba(245, 225, 206, 0.06)',
                    gap: '16px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.titulo}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.descripcion}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {item.teclas.map((k, ki) => (
                      <React.Fragment key={ki}>
                        {ki > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>+</span>}
                        <kbd
                          style={{
                            background: 'rgba(47, 44, 121, 0.75)',
                            border: '1px solid rgba(232, 195, 158, 0.40)',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.35)',
                            color: '#f5e1ce',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 800,
                            minWidth: '22px',
                            textAlign: 'center',
                            display: 'inline-block'
                          }}
                        >
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassModal>
  );
};
