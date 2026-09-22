# Bibliotecas e Referências

Este documento lista as dependências externas do projeto, para que serve cada uma e onde encontrar a documentação oficial.

## Dependências de produção

### @mediapipe/pose
- **Versão**: `^0.5.1675469404`
- **Uso**: modelo de estimativa de pose (33 landmarks corporais) usado para detectar nariz, olhos e ombros do usuário em tempo real a partir do vídeo da webcam.
- **Onde é usado**: [src/hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts)
- **Documentação oficial**: https://github.com/google/mediapipe/blob/master/docs/solutions/pose.md
- **Observação importante**: é distribuído como script UMD (não possui exports ESM reais para empacotar com Vite/Rollup). Por isso é carregado via `<script>` no [index.html](../index.html) e consumido a partir de `window` (ver `getMediapipeGlobals` em `usePoseTracking.ts`). Os tipos TypeScript (`Pose`, `PoseConfig`, `Options`, `Results`, etc.) são importados apenas com `import type` — não geram código em runtime.

### @mediapipe/camera_utils
- **Versão**: `^0.3.1675466862`
- **Uso**: utilitário `Camera` que gerencia o loop de captura de frames da webcam (`getUserMedia`) e os envia para o modelo `Pose` a cada frame.
- **Onde é usado**: [src/hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts)
- **Documentação oficial**: https://github.com/google/mediapipe/blob/master/docs/solutions/pose.md#javascript-solution-api
- **Observação**: mesmo caso do `@mediapipe/pose` — script UMD carregado via CDN/`<script>`, tipado com `import type`.

### @mediapipe/drawing_utils
- **Versão**: `^0.3.1675466124`
- **Uso**: funções `drawConnectors` e `drawLandmarks` para desenhar o esqueleto (conexões entre landmarks) e os pontos detectados sobre o canvas de vídeo.
- **Onde é usado**: [src/hooks/usePoseTracking.ts](../src/hooks/usePoseTracking.ts)
- **Documentação oficial**: https://github.com/google/mediapipe/blob/master/docs/solutions/pose.md#javascript-solution-api

### mathjs
- **Versão**: `^15.2.0`
- **Uso**: função `distance` para calcular a distância euclidiana 3D entre dois landmarks (usada para medir distância entre olhos e entre ombros).
- **Onde é usado**: [src/utils/geometry.ts](../src/utils/geometry.ts)
- **Documentação oficial**: https://mathjs.org/docs/reference/functions/distance.html

### react / react-dom
- **Versão**: `^19.2.8`
- **Uso**: biblioteca de UI. Componentes funcionais + hooks (`useState`, `useRef`, `useMemo`, `useEffect`).
- **Documentação oficial**: https://react.dev

## Dependências de desenvolvimento

### vite
- **Versão**: `^8.2.0`
- **Uso**: bundler/dev server. Configuração em [vite.config.ts](../vite.config.ts).
- **Documentação oficial**: https://vite.dev

### @vitejs/plugin-react
- **Versão**: `^6.0.4`
- **Uso**: plugin oficial do Vite para suporte a React (Fast Refresh, JSX) via Oxc/SWC.
- **Documentação oficial**: https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react

### typescript
- **Versão**: `~6.0.2`
- **Uso**: tipagem estática. Configuração dividida em [tsconfig.json](../tsconfig.json), [tsconfig.app.json](../tsconfig.app.json) e [tsconfig.node.json](../tsconfig.node.json).
- **Documentação oficial**: https://www.typescriptlang.org/docs/

### oxlint
- **Versão**: `^1.75.0`
- **Uso**: linter (baseado em Oxc, escrito em Rust — alternativa rápida ao ESLint). Configuração em [.oxlintrc.json](../.oxlintrc.json).
- **Documentação oficial**: https://oxc.rs/docs/guide/usage/linter

### @types/node, @types/react, @types/react-dom
- Definições de tipos para Node.js e React usadas apenas em tempo de desenvolvimento/compilação.

## Por que os pacotes do MediaPipe são carregados via `<script>` e não `import`?

Os pacotes `@mediapipe/pose`, `@mediapipe/camera_utils` e `@mediapipe/drawing_utils` são publicados no npm como bundles UMD que assumem um ambiente de browser e anexam suas APIs diretamente em `window` (`window.Pose`, `window.Camera`, `window.drawConnectors`, `window.drawLandmarks`, `window.POSE_CONNECTIONS`). Eles não expõem um entry point ESM real, então o Vite não consegue importá-los como módulos normais.

A solução adotada:
1. Os scripts são carregados via tag `<script>` no `index.html`, apontando para a CDN `jsdelivr`.
2. O modelo `Pose` é instanciado com `locateFile` apontando também para a CDN, para carregar os arquivos `.wasm`/`.binarypb` do modelo.
3. Em `usePoseTracking.ts`, a função `getMediapipeGlobals()` lê essas globais de `window` com checagem de existência, e os `import type` trazem apenas os tipos TypeScript (sem gerar código JS em runtime).
