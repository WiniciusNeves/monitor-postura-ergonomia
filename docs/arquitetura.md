# Visão Geral e Arquitetura

## O que o sistema faz

Aplicação web (React + TypeScript + Vite) que usa a webcam do usuário para monitorar postura ergonômica em tempo real, detectando:

- **Proximidade excessiva da tela** (aproximação do rosto em relação à distância de calibração).
- **Inclinação do pescoço** (cabeça inclinada para frente/lado em relação à linha dos ombros).
- **Assimetria de ombros** (um ombro mais alto que o outro, em relação à calibração).

Quando uma dessas condições ultrapassa um limiar, a interface exibe um aviso visual e (opcionalmente) emite um beep sonoro.

## Diagrama de alto nível

```
Webcam ──▶ @mediapipe/camera_utils (Camera)
              │ envia frames
              ▼
        @mediapipe/pose (Pose)
              │ onResults() → 33 landmarks (x, y, z, visibility)
              ▼
    usePoseTracking (hook)
        │  desenha overlay no <canvas> (@mediapipe/drawing_utils)
        │  expõe `landmarks` para a UI
        ▼
    analyzePosture() / buildBaseline()  (utils/postureAnalysis.ts)
        │  usa geometry.ts (mathjs) para distâncias e ângulos
        │  compara métricas atuais vs. baseline calibrado
        ▼
    PostureAnalysis { metrics, deviations, landmarksVisible }
        │
        ├──▶ StatusPanel (UI: badge de status, métricas, lista de desvios)
        └──▶ usePostureAlerts → utils/alerts.ts (beep via Web Audio API)
```

## Módulos principais

| Módulo | Responsabilidade |
|---|---|
| [App.tsx](../src/App.tsx) | Componente raiz: mantém estado global (monitorando, calibrado, som), orquestra hooks e passa dados para os componentes visuais. |
| [components/VideoCanvas.tsx](../src/components/VideoCanvas.tsx) | Renderiza o `<video>` (fonte da webcam, oculto/pausado) e o `<canvas>` (overlay desenhado pelo MediaPipe). |
| [components/StatusPanel.tsx](../src/components/StatusPanel.tsx) | Painel lateral: botões de iniciar/parar monitoramento, calibrar, alternar som, e exibição das métricas/desvios atuais. |
| [hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts) | Integra `Pose` + `Camera` do MediaPipe; converte frames de vídeo em landmarks; gerencia ciclo de vida (start/stop) e retries de acesso à webcam. |
| [hooks/usePostureAlerts.ts](../src/hooks/usePostureAlerts.ts) | Observa a lista de desvios detectados e dispara alertas sonoros respeitando um cooldown. |
| [utils/postureAnalysis.ts](../src/utils/postureAnalysis.ts) | Regras de negócio: calcula métricas a partir dos landmarks e gera baseline/desvios com base em limiares (thresholds). |
| [utils/geometry.ts](../src/utils/geometry.ts) | Funções matemáticas puras: distância euclidiana 3D, ângulo de inclinação, ponto médio. |
| [utils/alerts.ts](../src/utils/alerts.ts) | Geração do beep sonoro via Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`). |
| [types/posture.ts](../src/types/posture.ts) | Tipos e constantes compartilhadas (`PoseLandmarks`, `POSE_INDEX`, `PostureMetrics`, `PostureDeviation`, etc.). |

## Fluxo de estado (App.tsx)

1. Usuário clica em **"Iniciar monitoramento"** → `monitoring = true` → ativa `usePoseTracking`.
2. `usePoseTracking` inicia a câmera e o modelo `Pose`, populando `landmarks` a cada frame.
3. Usuário clica em **"Calibrar postura"** (requer landmarks visíveis) → `buildBaseline(landmarks)` grava a postura atual como referência (`baseline`).
4. A cada atualização de `landmarks`/`baseline`, `analyzePosture()` recalcula `PostureAnalysis` (métricas + desvios) via `useMemo`.
5. `usePostureAlerts` observa `analysis.deviations` e toca um beep (com cooldown de 4s) quando há desvio e o som está habilitado.
6. `StatusPanel` renderiza o status atual (badge colorido, métricas numéricas, lista de mensagens de desvio).
7. Ao parar o monitoramento, o `baseline` é descartado (nova calibração é necessária ao reiniciar).

Mais detalhes sobre o cálculo das métricas e os limiares usados estão em [Fluxo de Detecção de Postura](./fluxo-postura.md).
