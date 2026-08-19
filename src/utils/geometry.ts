import { distance } from 'mathjs';
import type { Landmark3D } from '../types/posture';

export function euclideanDistance3D(a: Landmark3D, b: Landmark3D): number {
  return distance([a.x, a.y, a.z], [b.x, b.y, b.z]) as number;
}

// Ângulo (graus) da reta entre dois pontos em relação à horizontal, no plano XY.
export function tiltAngleDeg(a: Landmark3D, b: Landmark3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

// Ângulo (graus) entre o vetor nariz->ponto-médio-dos-ombros e a vertical,
// usado como aproximação da inclinação do pescoço.
export function verticalDeviationDeg(top: Landmark3D, bottom: Landmark3D): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  const angleFromVertical = Math.atan2(dx, -dy) * (180 / Math.PI);
  return angleFromVertical;
}

export function midpoint(a: Landmark3D, b: Landmark3D): Landmark3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}
