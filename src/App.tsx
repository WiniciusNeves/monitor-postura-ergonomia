import { useEffect, useMemo, useRef, useState } from 'react';
import { VideoCanvas } from './components/VideoCanvas';
import { StatusPanel } from './components/StatusPanel';
import { usePoseTracking } from './hooks/usePoseTracking';
import { usePostureAlerts } from './hooks/usePostureAlerts';
import { useStableAnalysis } from './hooks/useStableAnalysis';
import { analyzePosture, averageBaselines, buildBaseline, getOverallSeverity } from './utils/postureAnalysis';
import type { CalibrationBaseline, OverallSeverity, PostureAnalysis } from './types/posture';
import './App.css';

const EMPTY_ANALYSIS: PostureAnalysis = {
  metrics: { eyeDistance: 0, shoulderDistance: 0, shoulderTiltDeg: 0, neckTiltDeg: 0, screenProximityRatio: 1 },
  deviations: [],
  landmarksVisible: false,
};

const OVERLAY_COLORS: Record<OverallSeverity, string> = {
  ok: '#00d4a0',
  warning: '#ffb020',
  critical: '#ff4d4f',
};

// Calibrar com um único frame é sensível a uma micro-oscilação momentânea;
// coletar amostras por esse período e tirar a média deixa a baseline mais confiável.
const CALIBRATION_DURATION_MS = 1500;

const SOUND_PREFERENCE_KEY = 'monitor-postura:soundEnabled';

function loadSoundPreference(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_PREFERENCE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [monitoring, setMonitoring] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundPreference);
  const [baseline, setBaseline] = useState<CalibrationBaseline | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [overlayColor, setOverlayColor] = useState<string>(OVERLAY_COLORS.ok);

  const calibrationSamplesRef = useRef<CalibrationBaseline[]>([]);
  const calibrationDeadlineRef = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(SOUND_PREFERENCE_KEY, String(soundEnabled));
    } catch {
      // localStorage indisponível (ex.: modo privado); preferência só dura a sessão.
    }
  }, [soundEnabled]);

  const { landmarks, error: cameraError, isLoading } = usePoseTracking({
    videoRef,
    canvasRef,
    active: monitoring,
    overlayColor,
  });

  const rawAnalysis = useMemo<PostureAnalysis>(() => {
    if (!landmarks) return EMPTY_ANALYSIS;
    return analyzePosture(landmarks, baseline);
  }, [landmarks, baseline]);

  const analysis = useStableAnalysis(rawAnalysis);
  const severity = getOverallSeverity(analysis.deviations);

  // Cor do overlay reflete a severidade com ~1 frame de atraso (o valor é
  // aplicado no próximo frame de vídeo processado) — imperceptível na prática
  // e evita acoplar o hook de tracking às regras de negócio de postura.
  useEffect(() => {
    setOverlayColor(baseline ? OVERLAY_COLORS[severity] : OVERLAY_COLORS.ok);
  }, [severity, baseline]);

  usePostureAlerts(monitoring ? analysis.deviations : [], soundEnabled);

  // Enquanto calibra, acumula uma amostra por frame durante CALIBRATION_DURATION_MS
  // e depois grava a média — mais estável que capturar um único instante.
  useEffect(() => {
    if (!calibrating || !landmarks) return;
    calibrationSamplesRef.current.push(buildBaseline(landmarks));
    if (Date.now() >= calibrationDeadlineRef.current) {
      setBaseline(averageBaselines(calibrationSamplesRef.current));
      calibrationSamplesRef.current = [];
      setCalibrating(false);
    }
  }, [landmarks, calibrating]);

  const handleCalibrate = () => {
    if (!landmarks || calibrating) return;
    calibrationSamplesRef.current = [];
    calibrationDeadlineRef.current = Date.now() + CALIBRATION_DURATION_MS;
    setCalibrating(true);
  };

  const handleToggleMonitoring = () => {
    setMonitoring((prev) => !prev);
    // Parar o monitoramento no meio de uma calibração deixaria `calibrating`
    // travado para sempre, já que `landmarks` some e o efeito acima nunca mais roda.
    setCalibrating(false);
    calibrationSamplesRef.current = [];
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Monitor Inteligente de Postura e Ergonomia</h1>
        <p>Computação Gráfica e Realidade Virtual · Projeto A3</p>
      </header>

      <main className="app__main">
        <VideoCanvas videoRef={videoRef} canvasRef={canvasRef} />
        <StatusPanel
          analysis={analysis}
          monitoring={monitoring}
          isCalibrated={baseline !== null}
          calibrating={calibrating}
          isLoading={isLoading}
          onToggleMonitoring={handleToggleMonitoring}
          onCalibrate={handleCalibrate}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((v) => !v)}
          cameraError={cameraError}
        />
      </main>
    </div>
  );
}

export default App;
