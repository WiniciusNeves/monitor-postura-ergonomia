export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type PoseLandmarks = Landmark3D[];

// Índices dos landmarks do MediaPipe Pose usados no monitoramento.
export const POSE_INDEX = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
} as const;

export interface CalibrationBaseline {
  eyeDistance: number;
  shoulderDistance: number;
  shoulderTiltDeg: number;
  neckTiltDeg: number;
}

export interface PostureMetrics {
  eyeDistance: number;
  shoulderDistance: number;
  shoulderTiltDeg: number;
  neckTiltDeg: number;
  screenProximityRatio: number;
}

export type DeviationType =
  | 'PROXIMITY'
  | 'NECK_TILT'
  | 'SHOULDER_ASYMMETRY';

export interface PostureDeviation {
  type: DeviationType;
  severity: 'warning' | 'critical';
  message: string;
}

export interface PostureAnalysis {
  metrics: PostureMetrics;
  deviations: PostureDeviation[];
  landmarksVisible: boolean;
}
