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

// Os scripts UMD do MediaPipe são carregados com `defer` (ver index.html) e podem
// ainda não ter terminado de baixar/executar quando o usuário clica em "iniciar
// monitoramento". Em vez de falhar de cara, tenta novamente por alguns segundos
// antes de reportar erro real ao usuário.
const GLOBALS_POLL_INTERVAL_MS = 250;
const GLOBALS_POLL_MAX_ATTEMPTS = 20; // ~5s

async function waitForMediapipeGlobals(isCancelled: () => boolean): Promise<MediapipeGlobals | null> {
  for (let attempt = 0; attempt < GLOBALS_POLL_MAX_ATTEMPTS; attempt++) {
    const globals = getMediapipeGlobals();
    if (globals) return globals;
    if (isCancelled()) return null;
    await new Promise((resolve) => setTimeout(resolve, GLOBALS_POLL_INTERVAL_MS));
  }
  return null;
}

// Câmeras físicas costumam levar um tempo para inicializar/liberar o
// dispositivo (ex.: acabaram de ser usadas por outra aba/app), então o
// primeiro getUserMedia falha com NotReadableError. Tenta novamente com
// backoff antes de desistir e mostrar erro ao usuário.
const RETRY_DELAYS_MS = [500, 1000, 2000, 3000];

interface UsePoseTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  active: boolean;
  /** Cor (CSS) do esqueleto desenhado sobre o vídeo; reflete a severidade da postura atual. */
  overlayColor?: string;
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

const DEFAULT_OVERLAY_COLOR = '#00d4a0';

export function usePoseTracking({
  videoRef,
  canvasRef,
  active,
  overlayColor,
}: UsePoseTrackingOptions): UsePoseTrackingResult {
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const poseRef = useRef<PoseClass | null>(null);
  const cameraRef = useRef<CameraClass | null>(null);

  // Lido dentro do onResults (fechado uma única vez por sessão de tracking),
  // por isso fica em ref: assim a cor pode mudar a cada frame sem precisar
  // recriar o Pose/Camera.
  const overlayColorRef = useRef(overlayColor ?? DEFAULT_OVERLAY_COLOR);
  useEffect(() => {
    overlayColorRef.current = overlayColor ?? DEFAULT_OVERLAY_COLOR;
  }, [overlayColor]);

  useEffect(() => {
    if (!active) {
      setLandmarks(null);
      return;
    }

    if (!videoRef.current || !canvasRef.current) return;
    // Aliases com tipo explícito não-nulo: o narrowing do guard acima não
    // atravessa a função async `setup` aninhada abaixo.
    const videoEl: HTMLVideoElement = videoRef.current;
    const canvasEl: HTMLCanvasElement = canvasRef.current;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function startCameraWithRetry(camera: CameraClass): Promise<void> {
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

    let visibilityHandler: (() => void) | null = null;

    async function setup() {
      const globals = await waitForMediapipeGlobals(() => cancelled);
      if (cancelled) return;
      if (!globals) {
        setError('Bibliotecas do MediaPipe não carregaram. Verifique a conexão com a internet.');
        setIsLoading(false);
        return;
      }

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
          const color = overlayColorRef.current;
          globals.drawConnectors(canvasCtx, results.poseLandmarks, globals.POSE_CONNECTIONS, {
            color,
            lineWidth: 2,
          });
          globals.drawLandmarks(canvasCtx, results.poseLandmarks, { color, radius: 3 });
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

      await startCameraWithRetry(camera);
      if (cancelled) return;

      // Desliga a captura quando a aba vai para segundo plano (economiza CPU e
      // apaga o indicador de câmera ativa) e retoma ao voltar o foco.
      visibilityHandler = () => {
        if (cancelled || !cameraRef.current) return;
        if (document.hidden) {
          void cameraRef.current.stop();
        } else {
          void startCameraWithRetry(cameraRef.current);
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    void setup();

    return () => {
      cancelled = true;
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      void cameraRef.current?.stop();
      void poseRef.current?.close();
      poseRef.current = null;
      cameraRef.current = null;
    };
  }, [active, videoRef, canvasRef]);

  return { landmarks, error, isLoading };
}
