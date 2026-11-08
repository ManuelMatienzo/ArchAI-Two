import React, { useState } from 'react';
import { Image, FileCode, Download, Sun, Moon, Palette } from 'lucide-react';
import { GlassModal } from '../glass/GlassModal';
import { ModeloDiagrama } from '../../types/uml';
import { exportDiagramAsPng, exportDiagramAsSvg, VisualExportOptions } from '../../services/visualExportService';

interface ModalExportarVisualProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: ModeloDiagrama;
  onSuccess?: (mensaje: string) => void;
}

export const ModalExportarVisual: React.FC<ModalExportarVisualProps> = ({
  isOpen,
  onClose,
  diagram,
  onSuccess
}) => {
  const [formato, setFormato] = useState<'png' | 'svg'>('png');
  const [tema, setTema] = useState<'dark' | 'light' | 'transparent'>('dark');
  const [escala, setEscala] = useState<number>(2);
  const [exportando, setExportando] = useState(false);

  if (!isOpen) return null;

  const handleExportar = async () => {
    setExportando(true);
    try {
      const opciones: VisualExportOptions = {
        theme: tema,
        scale: escala,
        watermark: true
      };

      if (formato === 'svg') {
        exportDiagramAsSvg(diagram, opciones);
        onSuccess?.('Diagrama exportado exitosamente como SVG vectorial.');
      } else {
        await exportDiagramAsPng(diagram, opciones);
        onSuccess?.(`Diagrama exportado exitosamente como PNG (${escala}x).`);
      }
      onClose();
    } catch (err: any) {
      console.error('Error al exportar visualmente el diagrama:', err);
      alert(`Error al exportar: ${err?.message || 'Fallo inesperado'}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Exportar Diagrama como Imagen"
      subtitle="Descarga tu modelo UML 2.5 en formatos gráficos de alta resolución"
      icon={<Image size={20} />}
      iconColor="#e8c39e"
      iconBg="rgba(232, 195, 158, 0.15)"
      maxWidth="500px"
      footer={
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-studio-glass"
            style={{
              padding: '9px 18px',
              fontSize: '0.84rem',
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            disabled={exportando}
            className="btn-studio-primary"
            style={{
              padding: '9px 22px',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: exportando ? 'wait' : 'pointer',
              opacity: exportando ? 0.7 : 1
            }}
          >
            {exportando ? (
              <span>Generando imagen...</span>
            ) : (
              <>
                <Download size={15} />
                <span>Descargar {formato.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Selector de Formato */}
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Formato de Archivo
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setFormato('png')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: formato === 'png' ? '1.5px solid #e8c39e' : '1px solid rgba(245, 225, 206, 0.12)',
                background: formato === 'png' ? 'rgba(232, 195, 158, 0.12)' : 'rgba(23, 26, 74, 0.35)',
                color: '#f5e1ce',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Image size={18} color="#e8c39e" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>PNG Raster</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Para documentos y redes</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormato('svg')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: formato === 'svg' ? '1.5px solid #38bdf8' : '1px solid rgba(245, 225, 206, 0.12)',
                background: formato === 'svg' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(23, 26, 74, 0.35)',
                color: '#f5e1ce',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <FileCode size={18} color="#38bdf8" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>SVG Vectorial</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Escalable sin pérdida</div>
              </div>
            </button>
          </div>
        </div>

        {/* Selector de Tema Visual */}
        <div>
          <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tema de Exportación
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setTema('dark')}
              style={{
                padding: '10px 8px',
                borderRadius: '10px',
                border: tema === 'dark' ? '1.5px solid #e8c39e' : '1px solid rgba(245, 225, 206, 0.12)',
                background: tema === 'dark' ? 'rgba(232, 195, 158, 0.15)' : 'rgba(23, 26, 74, 0.35)',
                color: '#f5e1ce',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Moon size={16} color="#e8c39e" />
              <span>Oscuro ArchAI</span>
            </button>

            <button
              type="button"
              onClick={() => setTema('light')}
              style={{
                padding: '10px 8px',
                borderRadius: '10px',
                border: tema === 'light' ? '1.5px solid #38bdf8' : '1px solid rgba(245, 225, 206, 0.12)',
                background: tema === 'light' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(23, 26, 74, 0.35)',
                color: '#f5e1ce',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Sun size={16} color="#38bdf8" />
              <span>Claro / Impresión</span>
            </button>

            <button
              type="button"
              onClick={() => setTema('transparent')}
              style={{
                padding: '10px 8px',
                borderRadius: '10px',
                border: tema === 'transparent' ? '1.5px solid #a855f7' : '1px solid rgba(245, 225, 206, 0.12)',
                background: tema === 'transparent' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(23, 26, 74, 0.35)',
                color: '#f5e1ce',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Palette size={16} color="#a855f7" />
              <span>Transparente</span>
            </button>
          </div>
        </div>

        {/* Selector de Escala (solo para PNG) */}
        {formato === 'png' && (
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Resolución y Calidad (DPI)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
              {[
                { val: 1, label: '1x Estándar', desc: 'Web / Pantalla' },
                { val: 2, label: '2x Retina', desc: 'Alta Definición' },
                { val: 3, label: '3x Ultra HD', desc: 'Impresión / Tesis' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setEscala(opt.val)}
                  style={{
                    padding: '8px 6px',
                    borderRadius: '10px',
                    border: escala === opt.val ? '1.5px solid #e8c39e' : '1px solid rgba(245, 225, 206, 0.12)',
                    background: escala === opt.val ? 'rgba(232, 195, 158, 0.15)' : 'rgba(23, 26, 74, 0.35)',
                    color: '#f5e1ce',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{opt.label}</div>
                  <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Resumen de elementos en el diagrama */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(245, 225, 206, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)'
          }}
        >
          <span>Elementos a exportar:</span>
          <span style={{ color: '#e8c39e', fontWeight: 700 }}>
            {diagram.classes?.length || 0} Clases · {diagram.relations?.length || 0} Relaciones
          </span>
        </div>
      </div>
    </GlassModal>
  );
};

export default ModalExportarVisual;
