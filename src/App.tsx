import { useMemo, useRef, useState } from 'react';
import { VideoCanvas } from './components/VideoCanvas';
import { StatusPanel } from './components/StatusPanel';
import { usePoseTracking } from './hooks/usePoseTracking';
import { usePostureAlerts } from './hooks/usePostureAlerts';
import { analyzePosture, buildBaseline } from './utils/postureAnalysis';
import type { CalibrationBaseline, PostureAnalysis } from './types/posture';
import './App.css';

const EMPTY_ANALYSIS: PostureAnalysis = {
  metrics: { eyeDistance: 0, shoulderDistance: 0, shoulderTiltDeg: 0, neckTiltDeg: 0, screenProximityRatio: 1 },
  deviations: [],
  landmarksVisible: false,
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [monitoring, setMonitoring] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [baseline, setBaseline] = useState<CalibrationBaseline | null>(null);

  const { landmarks, error: cameraError } = usePoseTracking({
    videoRef,
    canvasRef,
    active: monitoring,
  });

  const analysis = useMemo<PostureAnalysis>(() => {
    if (!landmarks) return EMPTY_ANALYSIS;
    return analyzePosture(landmarks, baseline);
  }, [landmarks, baseline]);

  usePostureAlerts(monitoring ? analysis.deviations : [], soundEnabled);

  const handleCalibrate = () => {
    if (landmarks) {
      setBaseline(buildBaseline(landmarks));
    }
  };

  const handleToggleMonitoring = () => {
    setMonitoring((prev) => {
      if (prev) setBaseline(null);
      return !prev;
    });
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
