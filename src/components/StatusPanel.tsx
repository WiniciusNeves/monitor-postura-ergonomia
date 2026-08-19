import type { PostureAnalysis } from '../types/posture';

interface StatusPanelProps {
  analysis: PostureAnalysis;
  monitoring: boolean;
  isCalibrated: boolean;
  onToggleMonitoring: () => void;
  onCalibrate: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  cameraError: string | null;
}

export function StatusPanel({
  analysis,
  monitoring,
  isCalibrated,
  onToggleMonitoring,
  onCalibrate,
  soundEnabled,
  onToggleSound,
  cameraError,
}: StatusPanelProps) {
  const hasCritical = analysis.deviations.some((d) => d.severity === 'critical');
  const hasWarning = analysis.deviations.some((d) => d.severity === 'warning');

  const statusLabel = !monitoring
    ? 'Monitoramento parado'
    : !analysis.landmarksVisible
      ? 'Aguardando detecção...'
      : !isCalibrated
        ? 'Calibração necessária'
        : hasCritical
          ? 'Postura crítica'
          : hasWarning
            ? 'Atenção à postura'
            : 'Postura adequada';

  const statusClass = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';

  return (
    <aside className="status-panel">
      <div className={`status-panel__badge status-panel__badge--${monitoring ? statusClass : 'idle'}`}>
        {statusLabel}
      </div>

      {cameraError && <p className="status-panel__error">Erro na webcam: {cameraError}</p>}

      <div className="status-panel__actions">
        <button onClick={onToggleMonitoring}>
          {monitoring ? 'Parar monitoramento' : 'Iniciar monitoramento'}
        </button>
        <button onClick={onCalibrate} disabled={!monitoring || !analysis.landmarksVisible}>
          {isCalibrated ? 'Recalibrar postura' : 'Calibrar postura'}
        </button>
        <label className="status-panel__toggle">
          <input type="checkbox" checked={soundEnabled} onChange={onToggleSound} />
          Alertas sonoros
        </label>
      </div>

      <dl className="status-panel__metrics">
        <div>
          <dt>Proximidade da tela</dt>
          <dd>{isCalibrated ? `${(analysis.metrics.screenProximityRatio * 100).toFixed(0)}%` : '—'}</dd>
        </div>
        <div>
          <dt>Inclinação do pescoço</dt>
          <dd>{analysis.landmarksVisible ? `${analysis.metrics.neckTiltDeg.toFixed(1)}°` : '—'}</dd>
        </div>
        <div>
          <dt>Inclinação dos ombros</dt>
          <dd>{analysis.landmarksVisible ? `${analysis.metrics.shoulderTiltDeg.toFixed(1)}°` : '—'}</dd>
        </div>
      </dl>

      {analysis.deviations.length > 0 && (
        <ul className="status-panel__deviations">
          {analysis.deviations.map((d) => (
            <li key={d.type} className={`status-panel__deviation status-panel__deviation--${d.severity}`}>
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
