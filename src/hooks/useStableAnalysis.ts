import { useEffect, useRef, useState } from 'react';
import type { DeviationType, PostureAnalysis, PostureDeviation } from '../types/posture';

// Um desvio só é confirmado depois de persistir continuamente por esse tempo,
// evitando que o badge/alerta sonoro "pisque" quando uma métrica oscila bem
// perto do limiar entre frames consecutivos.
const STABILITY_MS = 400;

interface PendingDeviation {
  since: number;
  severity: PostureDeviation['severity'];
}

// Recebe a análise bruta (recalculada a cada frame) e devolve uma versão com
// os desvios "debounced" no tempo. As métricas numéricas continuam ao vivo;
// só a lista de desvios (usada por badge, overlay e beep) é estabilizada.
export function useStableAnalysis(analysis: PostureAnalysis): PostureAnalysis {
  const pendingRef = useRef<Map<DeviationType, PendingDeviation>>(new Map());
  const confirmedRef = useRef<Map<DeviationType, PostureDeviation>>(new Map());
  const [stableDeviations, setStableDeviations] = useState<PostureDeviation[]>([]);

  useEffect(() => {
    const now = Date.now();
    const pending = pendingRef.current;
    const confirmed = confirmedRef.current;
    const rawTypes = new Set(analysis.deviations.map((d) => d.type));

    for (const type of pending.keys()) {
      if (!rawTypes.has(type)) pending.delete(type);
    }
    for (const type of confirmed.keys()) {
      if (!rawTypes.has(type)) confirmed.delete(type);
    }

    for (const deviation of analysis.deviations) {
      const existing = pending.get(deviation.type);
      if (!existing || existing.severity !== deviation.severity) {
        pending.set(deviation.type, { since: now, severity: deviation.severity });
      } else if (now - existing.since >= STABILITY_MS) {
        confirmed.set(deviation.type, deviation);
      }
    }

    const next = Array.from(confirmed.values());
    setStableDeviations((prev) => (sameDeviations(prev, next) ? prev : next));
  }, [analysis]);

  return { ...analysis, deviations: stableDeviations };
}

function sameDeviations(a: PostureDeviation[], b: PostureDeviation[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((d, i) => d.type === b[i].type && d.severity === b[i].severity);
}
