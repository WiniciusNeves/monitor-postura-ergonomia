import {
  POSE_INDEX,
  type CalibrationBaseline,
  type PostureAnalysis,
  type PostureDeviation,
  type PostureMetrics,
  type PoseLandmarks,
} from '../types/posture';
import { euclideanDistance3D, midpoint, tiltAngleDeg, verticalDeviationDeg } from './geometry';

const MIN_VISIBILITY = 0.5;

const THRESHOLDS = {
  proximity: { warning: 1.25, critical: 1.5 },
  neckTiltDeg: { warning: 15, critical: 25 },
  shoulderTiltDeg: { warning: 8, critical: 15 },
};

function hasRequiredLandmarks(landmarks: PoseLandmarks): boolean {
  const indices = [
    POSE_INDEX.NOSE,
    POSE_INDEX.LEFT_EYE,
    POSE_INDEX.RIGHT_EYE,
    POSE_INDEX.LEFT_SHOULDER,
    POSE_INDEX.RIGHT_SHOULDER,
  ];
  return indices.every((i) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY);
}

export function computeMetrics(landmarks: PoseLandmarks, baseline: CalibrationBaseline | null): PostureMetrics {
  const nose = landmarks[POSE_INDEX.NOSE];
  const leftEye = landmarks[POSE_INDEX.LEFT_EYE];
  const rightEye = landmarks[POSE_INDEX.RIGHT_EYE];
  const leftShoulder = landmarks[POSE_INDEX.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_INDEX.RIGHT_SHOULDER];

  const eyeDistance = euclideanDistance3D(leftEye, rightEye);
  const shoulderDistance = euclideanDistance3D(leftShoulder, rightShoulder);
  const shoulderTiltDeg = tiltAngleDeg(leftShoulder, rightShoulder);
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const neckTiltDeg = verticalDeviationDeg(nose, shoulderMid);

  const screenProximityRatio = baseline ? eyeDistance / baseline.eyeDistance : 1;

  return { eyeDistance, shoulderDistance, shoulderTiltDeg, neckTiltDeg, screenProximityRatio };
}

export function analyzePosture(landmarks: PoseLandmarks, baseline: CalibrationBaseline | null): PostureAnalysis {
  const landmarksVisible = hasRequiredLandmarks(landmarks);
  const metrics = computeMetrics(landmarks, baseline);
  const deviations: PostureDeviation[] = [];

  if (landmarksVisible && baseline) {
    if (metrics.screenProximityRatio >= THRESHOLDS.proximity.critical) {
      deviations.push({
        type: 'PROXIMITY',
        severity: 'critical',
        message: 'Você está muito próximo da tela. Afaste-se imediatamente.',
      });
    } else if (metrics.screenProximityRatio >= THRESHOLDS.proximity.warning) {
      deviations.push({
        type: 'PROXIMITY',
        severity: 'warning',
        message: 'Aproximação excessiva da tela detectada.',
      });
    }

    const neckDeviation = Math.abs(metrics.neckTiltDeg - baseline.neckTiltDeg);
    if (neckDeviation >= THRESHOLDS.neckTiltDeg.critical) {
      deviations.push({
        type: 'NECK_TILT',
        severity: 'critical',
        message: 'Inclinação severa do pescoço. Ajuste sua postura agora.',
      });
    } else if (neckDeviation >= THRESHOLDS.neckTiltDeg.warning) {
      deviations.push({
        type: 'NECK_TILT',
        severity: 'warning',
        message: 'Inclinação do pescoço acima do ideal.',
      });
    }

    const shoulderDeviation = Math.abs(metrics.shoulderTiltDeg - baseline.shoulderTiltDeg);
    if (shoulderDeviation >= THRESHOLDS.shoulderTiltDeg.critical) {
      deviations.push({
        type: 'SHOULDER_ASYMMETRY',
        severity: 'critical',
        message: 'Assimetria severa de ombros detectada.',
      });
    } else if (shoulderDeviation >= THRESHOLDS.shoulderTiltDeg.warning) {
      deviations.push({
        type: 'SHOULDER_ASYMMETRY',
        severity: 'warning',
        message: 'Assimetria de ombros acima do ideal.',
      });
    }
  }

  return { metrics, deviations, landmarksVisible };
}

export function buildBaseline(landmarks: PoseLandmarks): CalibrationBaseline {
  const nose = landmarks[POSE_INDEX.NOSE];
  const leftEye = landmarks[POSE_INDEX.LEFT_EYE];
  const rightEye = landmarks[POSE_INDEX.RIGHT_EYE];
  const leftShoulder = landmarks[POSE_INDEX.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_INDEX.RIGHT_SHOULDER];

  const eyeDistance = euclideanDistance3D(leftEye, rightEye);
  const shoulderDistance = euclideanDistance3D(leftShoulder, rightShoulder);
  const shoulderTiltDeg = tiltAngleDeg(leftShoulder, rightShoulder);
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const neckTiltDeg = verticalDeviationDeg(nose, shoulderMid);

  return { eyeDistance, shoulderDistance, shoulderTiltDeg, neckTiltDeg };
}
