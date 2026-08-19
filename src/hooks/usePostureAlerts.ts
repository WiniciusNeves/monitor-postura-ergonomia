import { useEffect, useRef } from 'react';
import type { PostureDeviation } from '../types/posture';
import { playAlertBeep } from '../utils/alerts';

const ALERT_COOLDOWN_MS = 4000;

// Dispara alertas sonoros de forma assíncrona, sem travar a thread de renderização,
// respeitando um intervalo mínimo entre bipes para não soar continuamente.
export function usePostureAlerts(deviations: PostureDeviation[], soundEnabled: boolean): void {
  const lastPlayedAtRef = useRef(0);

  useEffect(() => {
    if (!soundEnabled || deviations.length === 0) return;

    const now = Date.now();
    if (now - lastPlayedAtRef.current < ALERT_COOLDOWN_MS) return;

    const hasCritical = deviations.some((d) => d.severity === 'critical');
    lastPlayedAtRef.current = now;

    void playAlertBeep(hasCritical ? 'critical' : 'warning');
  }, [deviations, soundEnabled]);
}
