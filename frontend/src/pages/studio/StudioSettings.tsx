import { useState, type ReactNode } from 'react';
import { Bot, Cloud, CloudOff, Cpu, Eye, History, Moon, RefreshCw, Save, Settings2, Sun, Users } from 'lucide-react';
import type { useProposals } from '../../components/collaboration/ProposalPanel';
import type { ProposalReview } from '../../components/collaboration/useProposalReview';
import type { InformacionSesion } from '../../types/auth';
import type { CloudOptions } from '../../services/proposalAgent';
import './StudioSettings.css';

interface StudioSettingsProps {
  session: InformacionSesion;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  pendingChanges: number;
  onSync: () => Promise<void>;
  state: ReturnType<typeof useProposals>;
  review: ProposalReview;
}

function SettingsCard({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="glass-card studio-settings-card" aria-labelledby={id}>
      <div className="studio-settings-card-heading">
        <span className="studio-settings-icon">{icon}</span>
        <h2 id={id}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function StudioSettings({ session, theme, onThemeChange, pendingChanges, onSync, state, review }: StudioSettingsProps) {
  const [checkpoint, setCheckpoint] = useState('');
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [checkingPoints, setCheckingPoints] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { mode, model, observing, canConfigure, cloud } = state.settings;

  async function loadCheckpoints() {
    setShowCheckpoints(true);
    setCheckingPoints(true);
    try {
      await state.loadCheckpoints();
    } finally {
      setCheckingPoints(false);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  }

  async function restoreCheckpoint() {
    if (!window.confirm('¿Restaurar este punto de control para todo el equipo? Se creará una nueva revisión.')) return;
    const next = await state.restore('restore', review.snapshot?.officialRevision || 0, checkpoint);
    if (next) review.receive(next);
  }

  return (
    <div className="studio-settings" aria-labelledby="studio-settings-title">
      <div className="studio-settings-content">
        <header className="studio-settings-heading">
          <span className="studio-settings-icon"><Settings2 size={22} /></span>
          <h1 id="studio-settings-title">Configuración del Estudio</h1>
        </header>

        {state.settingsError && <p className="studio-settings-error" role="alert">{state.settingsError}</p>}

        <div className="studio-settings-grid">
          <SettingsCard id="studio-assistant-title" icon={<Bot size={18} />} title="Preferencias del asistente">
            <div className="studio-settings-field">
              <span className="studio-settings-label">Motor compartido de la sala</span>
              <div className="proposal-engine-options" role="group" aria-label="Motor de la sala">
                <button type="button" disabled={!canConfigure} aria-pressed={mode === 'cloud'} onClick={() => void state.configure({ mode: 'cloud' })}>
                  <Cloud size={15} /> Nube
                </button>
                <button type="button" disabled={!canConfigure} aria-pressed={mode === 'local'} onClick={() => {
                  void state.configure({ mode: 'local' });
                  void state.checkModel();
                }}>
                  <Cpu size={15} /> Local
                </button>
              </div>
              {mode === 'cloud' ? (
                <p className="studio-settings-help">
                  Gemini{cloud.geminiModel && ` · ${cloud.geminiModel}`}
                  {cloud.fallbackEnabled && ` · respaldo Claude${cloud.claudeModel ? ` (${cloud.claudeModel})` : ''}`}. Las consultas pueden consumir cuota.
                </p>
              ) : (
                <>
                  <label className="studio-settings-label" htmlFor="studio-local-model">Modelo local</label>
                  <div className="studio-settings-controls">
                    <select id="studio-local-model" value={model} disabled={!canConfigure} onChange={(e) => void state.configure({ model: e.target.value })}>
                      {!state.localModels.includes(model) && <option>{model}</option>}
                      {state.localModels.map((name) => <option key={name}>{name}</option>)}
                    </select>
                    <button type="button" className="btn-studio-glass" disabled={state.checkingModel} onClick={() => void state.checkModel()}>
                      <RefreshCw size={14} /> {state.checkingModel ? 'Conectando…' : 'Conectar'}
                    </button>
                  </div>
                  <p className="studio-settings-help" role="status">
                    {state.modelError || (state.localModels.includes(model) ? `Conectado a Ollama · ${model}` : 'Comprueba la disponibilidad del modelo local.')}
                  </p>
                </>
              )}
            </div>

            <div className="studio-settings-row studio-settings-divider">
              <div>
                <span className="studio-settings-label"><Eye size={15} /> Observación automática</span>
                <p className="studio-settings-help">Revisa cambios estructurales. Hasta una revisión por minuto y diez por hora, sin respaldo de Claude.</p>
              </div>
              <button type="button" role="switch" className="proposal-switch" aria-label="Observación automática" aria-checked={observing} disabled={!canConfigure} onClick={() => void state.configure({ observing: !observing })}>
                <span />
              </button>
            </div>
            {!canConfigure && <p className="studio-settings-help">El anfitrión administra el motor y la observación.</p>}

            {import.meta.env.DEV && cloud.testControls && mode === 'cloud' && (
              <div className="studio-settings-field studio-settings-divider">
                <label className="studio-settings-label" htmlFor="studio-cloud-provider">Proveedor para pruebas</label>
                <div className="studio-settings-controls">
                  <select id="studio-cloud-provider" value={state.cloudOptions.provider || 'auto'} onChange={(e) => state.setCloudOptions({ ...state.cloudOptions, provider: e.target.value as CloudOptions['provider'] })}>
                    <option value="auto">Gemini → Claude</option>
                    <option value="gemini">Solo Gemini</option>
                    <option value="claude">Solo Claude</option>
                  </select>
                </div>
                <div className="studio-settings-row">
                  <span className="studio-settings-label">Permitir respaldo con Claude</span>
                  <button type="button" role="switch" className="proposal-switch" aria-label="Permitir respaldo con Claude" aria-checked={state.cloudOptions.allowFallback ?? cloud.fallbackEnabled} disabled={!cloud.fallbackEnabled} onClick={() => state.setCloudOptions({ ...state.cloudOptions, allowFallback: !(state.cloudOptions.allowFallback ?? cloud.fallbackEnabled) })}>
                    <span />
                  </button>
                </div>
              </div>
            )}
          </SettingsCard>

          <SettingsCard id="studio-team-title" icon={<Users size={18} />} title="Equipo y continuidad">
            <dl className="studio-settings-session">
              <div><dt>Tu cuenta</dt><dd>{session.currentUser.name}<small>{session.currentUser.role}</small></dd></div>
              <div><dt>PIN de sala</dt><dd className="studio-settings-pin">{session.roomId}</dd></div>
            </dl>
            <div className="studio-settings-members" aria-label="Participantes de la sala">
              <span><Bot size={13} /> ArchAI · IA</span>
              {state.participants.map((person) => (
                <span key={person.id}><i style={{ backgroundColor: person.avatarColor }} />{person.name}</span>
              ))}
            </div>
            <div className="studio-settings-field studio-settings-divider">
              <span className="studio-settings-label">Puntos de control</span>
              <div className="studio-settings-actions">
                <button type="button" className="btn-studio-primary" disabled={!review.canModerate} onClick={() => void state.saveSession()}>
                  <Save size={14} /> Guardar sesión
                </button>
                <button type="button" className="btn-studio-glass" disabled={checkingPoints} onClick={() => void loadCheckpoints()}>
                  <History size={14} /> {checkingPoints ? 'Cargando…' : 'Ver guardados'}
                </button>
              </div>
              {!!state.checkpoints.length && (
                <div className="studio-settings-controls">
                  <select aria-label="Punto de control" value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)}>
                    <option value="">Seleccionar guardado…</option>
                    {state.checkpoints.map((point) => (
                      <option key={point.id} value={point.id}>{new Date(point.savedAt).toLocaleString()} · {point.classes} clases</option>
                    ))}
                  </select>
                  <button type="button" className="btn-studio-glass" disabled={!checkpoint || !review.canModerate} onClick={() => void restoreCheckpoint()}>Restaurar</button>
                </div>
              )}
              {showCheckpoints && !checkingPoints && !state.checkpoints.length && !state.settingsError && (
                <p className="studio-settings-help" role="status">Todavía no hay puntos de control guardados.</p>
              )}
              {state.sessionNotice && <p className="studio-settings-help" role="status">{state.sessionNotice}</p>}
              {state.persistence && (!state.persistence.configured || !state.persistence.connected) && (
                <p className="studio-settings-help">La sesión tiene pendiente la sincronización con el historial compartido.</p>
              )}
            </div>
          </SettingsCard>

          <SettingsCard id="studio-theme-title" icon={<Sun size={18} />} title="Apariencia">
            <div className="proposal-engine-options" role="group" aria-label="Tema visual">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}><Sun size={15} /> Claro</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}><Moon size={15} /> Oscuro</button>
            </div>
          </SettingsCard>

          <SettingsCard id="studio-offline-title" icon={<CloudOff size={18} />} title="Trabajo sin conexión">
            <div className="studio-settings-row studio-settings-offline">
              <p className="studio-settings-help">{pendingChanges ? `${pendingChanges} ${pendingChanges === 1 ? 'cambio pendiente' : 'cambios pendientes'}` : 'Todos los cambios locales están sincronizados.'}</p>
              <button type="button" className="btn-studio-glass" disabled={syncing || !pendingChanges} onClick={() => void sync()}>
                <RefreshCw size={14} /> {syncing ? 'Sincronizando…' : 'Sincronizar'}
              </button>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
