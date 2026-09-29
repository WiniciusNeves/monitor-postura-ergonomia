# Fluxo de Detecção de Postura

Detalhamento do pipeline que vai do frame de vídeo até o alerta exibido/emitido para o usuário.

## 1. Captura e detecção de landmarks — `usePoseTracking`

Arquivo: [src/hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts)

1. Ao ativar (`active = true`), o hook espera as globais do MediaPipe aparecerem em `window` (`Pose`, `Camera`, `drawConnectors`, `drawLandmarks`, `POSE_CONNECTIONS`), tentando a cada 250ms por até ~5s (`waitForMediapipeGlobals`) — os scripts UMD são carregados com `defer` no `index.html`, então podem ainda não ter terminado de baixar quando o usuário clica em "iniciar". Só define `error` se esgotar as tentativas.
2. Instancia `Pose` com `locateFile` apontando para a CDN jsDelivr (arquivos do modelo) e opções fixas:
   - `modelComplexity: 1`, `smoothLandmarks: true`, `enableSegmentation: false`, `minDetectionConfidence: 0.5`, `minTrackingConfidence: 0.5`.
3. Registra `pose.onResults(...)`: a cada frame processado, desenha a imagem da câmera no `<canvas>`, sobrepõe as conexões (`drawConnectors`) e os pontos (`drawLandmarks`) — usando a cor passada em `overlayColor` (reflete a severidade atual da postura: verde/amarelo/vermelho, ver seção 7) — e atualiza o estado `landmarks` com os 33 pontos retornados (`results.poseLandmarks`).
4. Instancia `Camera`, que chama `pose.send({ image: videoEl })` a cada frame (resolução alvo 640×480).
5. Inicia a câmera com **retry/backoff** (`startCameraWithRetry`): tentativas nos delays `[500, 1000, 2000, 3000]` ms, pois câmeras físicas podem falhar no primeiro `getUserMedia` (`NotReadableError`) se acabaram de ser liberadas por outra aba/app.
6. Registra um listener de `visibilitychange`: quando a aba vai para segundo plano, para a câmera (`camera.stop()`, economiza CPU e apaga o indicador de câmera ativa); ao voltar o foco, reinicia com o mesmo retry/backoff.
7. No cleanup (desativação ou desmontagem), remove o listener de visibilidade, para a câmera (`camera.stop()`) e fecha o modelo (`pose.close()`).

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

Função `buildBaseline(landmarks)` grava os mesmos valores de `eyeDistance`, `shoulderDistance`, `shoulderTiltDeg` e `neckTiltDeg` de um frame — usados depois como referência "postura correta" do usuário. Isso é necessário porque a postura ideal varia por pessoa, distância da câmera e ângulo de instalação.

Um único frame é sensível a uma micro-oscilação momentânea, então `App.tsx` não calibra num instante só: ao clicar em "Calibrar postura", coleta uma amostra (`buildBaseline`) por frame durante `CALIBRATION_DURATION_MS` (1500ms) e grava a **média** das amostras (`averageBaselines`, em `postureAnalysis.ts`) como baseline final. Durante essa janela, o badge de status mostra "Calibrando... mantenha a postura correta" e o botão fica desabilitado.

A baseline **não é mais descartada** ao parar o monitoramento — ela permanece na sessão até o usuário clicar em "Recalibrar postura" ou recarregar a página, evitando recalibrar toda vez que só se quer pausar/retomar.

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

`getOverallSeverity(deviations)` (`postureAnalysis.ts`) resume a lista de desvios num único nível — `'ok' | 'warning' | 'critical'` (prioridade `critical` > `warning` > `ok`) — reaproveitado pelo `StatusPanel` (cor do badge) e pelo `App.tsx` (cor do overlay do esqueleto, ver seção 7).

### Estabilização temporal — `useStableAnalysis`

Arquivo: [src/hooks/useStableAnalysis.ts](../src/hooks/useStableAnalysis.ts)

`analyzePosture` roda a cada frame (~30x/s); perto da borda de um limiar, um desvio pode entrar e sair da lista a cada frame, fazendo o badge/beep "piscar". `useStableAnalysis` recebe a análise bruta e só confirma um desvio depois que ele persiste continuamente por `STABILITY_MS` (400ms); ao desaparecer da lista bruta, é removido imediatamente. Só a lista de `deviations` é estabilizada — as métricas numéricas exibidas continuam ao vivo. `App.tsx` usa a saída desse hook (não a bruta) para o badge, o overlay e os alertas sonoros.

## 6. Alertas sonoros — `usePostureAlerts` + `alerts.ts`

Arquivo: [src/hooks/usePostureAlerts.ts](../src/hooks/usePostureAlerts.ts)

- Só dispara se `soundEnabled` e houver ao menos um desvio.
- Respeita um **cooldown de 4000 ms** (`ALERT_COOLDOWN_MS`) entre beeps, para não soar continuamente.
- Se algum desvio for `critical`, toca o tom crítico; caso contrário, o tom de warning.

Arquivo: [src/utils/alerts.ts](../src/utils/alerts.ts)

- Usa a Web Audio API (`AudioContext`, `OscillatorNode` senoidal, `GainNode` com envelope de ataque/decaimento exponencial) para gerar um beep sem depender de arquivos de áudio externos.
- Frequência: **880 Hz** para `critical`, **587 Hz** para `warning`. Duração: ~0.35s.

## 7. Exibição — `StatusPanel` e overlay do vídeo

Arquivo: [src/components/StatusPanel.tsx](../src/components/StatusPanel.tsx)

Deriva o texto/cor do badge de status a partir da combinação de `monitoring`, `isLoading` (carregando o modelo), `landmarksVisible`, `calibrating`, `isCalibrated` e severidade dos desvios (`hasCritical` > `hasWarning` > "Postura adequada"). Exibe também as métricas numéricas (proximidade em %, ângulos em graus) e a lista de mensagens de desvio ativas.

Além do painel, `App.tsx` também dá feedback direto **no próprio vídeo**: o esqueleto desenhado por `usePoseTracking` (conexões + pontos) é colorido conforme `getOverallSeverity` — verde (`#00d4a0`) sem calibração ou postura ok, amarelo (`#ffb020`) em warning, vermelho (`#ff4d4f`) em critical. Essa cor é passada como prop `overlayColor` e chega ao hook com ~1 frame de atraso (repassada via estado, aplicada no próximo frame processado), o que é imperceptível e evita acoplar o hook de captura às regras de negócio de postura.
