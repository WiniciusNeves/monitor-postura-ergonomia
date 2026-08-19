import { useEffect, useRef, useState, type RefObject } from 'react';
import type {
  Pose as PoseClass,
  PoseConfig,
  Options as PoseOptions,
  Results,
  LandmarkConnectionArray,
} from '@mediapipe/pose';
import type { Camera as CameraClass, CameraOptions } from '@mediapipe/camera_utils';
import type { drawConnectors as DrawConnectorsFn, drawLandmarks as DrawLandmarksFn } from '@mediapipe/drawing_utils';
import type { PoseLandmarks } from '../types/posture';

// @mediapipe/pose, camera_utils e drawing_utils são distribuídos como scripts UMD
// que só anexam globais em `window` (ver index.html); não há exports ESM reais para empacotar.
interface MediapipeGlobals {
  Pose: new (config?: PoseConfig) => PoseClass;
  POSE_CONNECTIONS: LandmarkConnectionArray;
  Camera: new (video: HTMLVideoElement, options: CameraOptions) => CameraClass;
  drawConnectors: typeof DrawConnectorsFn;
  drawLandmarks: typeof DrawLandmarksFn;
}

function getMediapipeGlobals(): MediapipeGlobals | null {
  const w = window as unknown as Partial<MediapipeGlobals>;
  if (!w.Pose || !w.Camera || !w.drawConnectors || !w.drawLandmarks || !w.POSE_CONNECTIONS) {
    return null;
  }
  return w as MediapipeGlobals;
}

interface UsePoseTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
}

interface UsePoseTrackingResult {
  landmarks: PoseLandmarks | null;
  error: string | null;
  isLoading: boolean;
}

const POSE_OPTIONS: PoseOptions = {
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export function usePoseTracking({ videoRef, canvasRef, active }: UsePoseTrackingOptions): UsePoseTrackingResult {
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const poseRef = useRef<PoseClass | null>(null);
  const cameraRef = useRef<CameraClass | null>(null);

  useEffect(() => {
    if (!active) {
      setLandmarks(null);
      return;
    }

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;

    const globals = getMediapipeGlobals();
    if (!globals) {
      setError('Bibliotecas do MediaPipe não carregaram. Verifique a conexão com a internet.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const pose = new globals.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    pose.setOptions(POSE_OPTIONS);

    pose.onResults((results: Results) => {
      setIsLoading(false);
      const canvasCtx = canvasEl.getContext('2d');
      if (!canvasCtx) return;

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      canvasCtx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height);

      if (results.poseLandmarks) {
        globals.drawConnectors(canvasCtx, results.poseLandmarks, globals.POSE_CONNECTIONS, {
          color: '#00d4a0',
          lineWidth: 2,
        });
        globals.drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#ff5f6d', radius: 3 });
        setLandmarks(results.poseLandmarks as PoseLandmarks);
      } else {
        setLandmarks(null);
      }
      canvasCtx.restore();
    });

    poseRef.current = pose;

    const camera = new globals.Camera(videoEl, {
      onFrame: async () => {
        await pose.send({ image: videoEl });
      },
      width: 640,
      height: 480,
    });
    cameraRef.current = camera;

    let cancelled = false;
    // Câmeras físicas costumam levar um tempo para inicializar/liberar o
    // dispositivo (ex.: acabaram de ser usadas por outra aba/app), então o
    // primeiro getUserMedia falha com NotReadableError. Tenta novamente com
    // backoff antes de desistir e mostrar erro ao usuário.
    const RETRY_DELAYS_MS = [500, 1000, 2000, 3000];

    async function startCameraWithRetry(): Promise<void> {
      for (let attempt = 0; ; attempt++) {
        try {
          await camera.start();
          return;
        } catch (err: unknown) {
          if (cancelled) return;
          if (attempt >= RETRY_DELAYS_MS.length) {
            const msg = err instanceof Error ? err.message : 'Falha ao acessar a webcam.';
            setError(msg);
            setIsLoading(false);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
      }
    }

    void startCameraWithRetry();

    return () => {
      cancelled = true;
      void cameraRef.current?.stop();
      void poseRef.current?.close();
      poseRef.current = null;
      cameraRef.current = null;
    };
  }, [active, videoRef, canvasRef]);

  return { landmarks, error, isLoading };
}
