# Fluxo de Detecção de Postura

Detalhamento do pipeline que vai do frame de vídeo até o alerta exibido/emitido para o usuário.

## 1. Captura e detecção de landmarks — `usePoseTracking`

Arquivo: [src/hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts)

1. Ao ativar (`active = true`), o hook busca as globais do MediaPipe em `window` (`Pose`, `Camera`, `drawConnectors`, `drawLandmarks`, `POSE_CONNECTIONS`). Se não existirem, define `error` (bibliotecas não carregadas).
2. Instancia `Pose` com `locateFile` apontando para a CDN jsDelivr (arquivos do modelo) e opções fixas:
   - `modelComplexity: 1`, `smoothLandmarks: true`, `enableSegmentation: false`, `minDetectionConfidence: 0.5`, `minTrackingConfidence: 0.5`.
3. Registra `pose.onResults(...)`: a cada frame processado, desenha a imagem da câmera no `<canvas>`, sobrepõe as conexões (`drawConnectors`) e os pontos (`drawLandmarks`), e atualiza o estado `landmarks` com os 33 pontos retornados (`results.poseLandmarks`).
4. Instancia `Camera`, que chama `pose.send({ image: videoEl })` a cada frame (resolução alvo 640×480).
5. Inicia a câmera com **retry/backoff** (`startCameraWithRetry`): tentativas nos delays `[500, 1000, 2000, 3000]` ms, pois câmeras físicas podem falhar no primeiro `getUserMedia` (`NotReadableError`) se acabaram de ser liberadas por outra aba/app.
6. No cleanup (desativação ou desmontagem), para a câmera (`camera.stop()`) e fecha o modelo (`pose.close()`).

## 2. Landmarks relevantes

Arquivo: [src/types/posture.ts](../src/types/posture.ts)

De todos os 33 landmarks do MediaPipe Pose, o sistema usa apenas 5 índices (`POSE_INDEX`):

| Landmark | Índice |
|---|---|
| Nariz (`NOSE`) | 0 |
| Olho esquerdo (`LEFT_EYE`) | 2 |
| Olho direito (`RIGHT_EYE`) | 5 |
| Ombro esquerdo (`LEFT_SHOULDER`) | 11 |
| Ombro direito (`RIGHT_SHOULDER`) | 12 |

Cada landmark tem `{ x, y, z, visibility? }` (coordenadas normalizadas + confiança de visibilidade).

## 3. Cálculo de métricas — `postureAnalysis.ts` + `geometry.ts`

### Funções geométricas puras ([geometry.ts](../src/utils/geometry.ts))
- `euclideanDistance3D(a, b)`: distância euclidiana 3D via `mathjs.distance`.
- `tiltAngleDeg(a, b)`: ângulo (graus) da reta entre dois pontos em relação à horizontal, no plano XY — usado para inclinação dos ombros.
- `verticalDeviationDeg(top, bottom)`: ângulo (graus) entre o vetor "topo→base" e a vertical — usado para inclinação do pescoço (nariz em relação ao ponto médio dos ombros).
- `midpoint(a, b)`: ponto médio 3D entre dois landmarks.

### Métricas calculadas (`computeMetrics`)
- **`eyeDistance`**: distância entre os dois olhos — quanto menor, mais perto da câmera o rosto está (usado como proxy de proximidade à tela).
- **`shoulderDistance`**: distância entre os ombros.
- **`shoulderTiltDeg`**: inclinação da linha dos ombros.
- **`neckTiltDeg`**: inclinação do pescoço (nariz vs. ponto médio dos ombros).
- **`screenProximityRatio`**: `eyeDistance atual / eyeDistance da calibração`. Sem calibração, assume `1` (neutro).

## 4. Calibração (baseline)

Função `buildBaseline(landmarks)` grava, no momento da calibração, os mesmos valores de `eyeDistance`, `shoulderDistance`, `shoulderTiltDeg` e `neckTiltDeg` — usados depois como referência "postura correta" do usuário. Isso é necessário porque a postura ideal varia por pessoa, distância da câmera e ângulo de instalação.

## 5. Geração de desvios (`analyzePosture`)

Desvios só são avaliados se **há calibração** (`baseline`) e **os landmarks obrigatórios estão visíveis** (`hasRequiredLandmarks`: nariz, olhos e ombros com `visibility >= 0.5`).

### Limiares (`THRESHOLDS`)

| Métrica | Warning | Critical |
|---|---|---|
| Proximidade (`screenProximityRatio`) | ≥ 1.25 | ≥ 1.5 |
| Inclinação do pescoço (desvio em relação ao baseline) | ≥ 15° | ≥ 25° |
| Inclinação dos ombros (desvio em relação ao baseline) | ≥ 8° | ≥ 15° |

Para cada métrica, o desvio (`critical` tem prioridade sobre `warning`) gera um objeto `PostureDeviation { type, severity, message }`, com tipos:
- `PROXIMITY` — aproximação excessiva da tela.
- `NECK_TILT` — inclinação do pescoço.
- `SHOULDER_ASYMMETRY` — assimetria de ombros.

## 6. Alertas sonoros — `usePostureAlerts` + `alerts.ts`

Arquivo: [src/hooks/usePostureAlerts.ts](../src/hooks/usePostureAlerts.ts)

- Só dispara se `soundEnabled` e houver ao menos um desvio.
- Respeita um **cooldown de 4000 ms** (`ALERT_COOLDOWN_MS`) entre beeps, para não soar continuamente.
- Se algum desvio for `critical`, toca o tom crítico; caso contrário, o tom de warning.

Arquivo: [src/utils/alerts.ts](../src/utils/alerts.ts)

- Usa a Web Audio API (`AudioContext`, `OscillatorNode` senoidal, `GainNode` com envelope de ataque/decaimento exponencial) para gerar um beep sem depender de arquivos de áudio externos.
- Frequência: **880 Hz** para `critical`, **587 Hz** para `warning`. Duração: ~0.35s.

## 7. Exibição — `StatusPanel`

Arquivo: [src/components/StatusPanel.tsx](../src/components/StatusPanel.tsx)

Deriva o texto/cor do badge de status a partir da combinação de `monitoring`, `landmarksVisible`, `isCalibrated` e severidade dos desvios (`hasCritical` > `hasWarning` > "Postura adequada"). Exibe também as métricas numéricas (proximidade em %, ângulos em graus) e a lista de mensagens de desvio ativas.
