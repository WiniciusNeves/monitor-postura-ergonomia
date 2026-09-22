# Estrutura do Projeto

```
monitor-postura-ergonomia/
├── index.html                    # HTML raiz; carrega scripts UMD do MediaPipe via <script>
├── vite.config.ts                # configuração do Vite
├── tsconfig.json / .app.json / .node.json   # configuração TypeScript (projeto dividido)
├── .oxlintrc.json                 # configuração do linter (oxlint)
├── package.json                   # dependências e scripts (dev/build/lint/preview)
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── docs/                           # esta documentação
│   ├── README.md
│   ├── arquitetura.md
│   ├── bibliotecas.md
│   ├── fluxo-postura.md
│   └── estrutura.md
└── src/
    ├── main.tsx                    # entrypoint React (ReactDOM.createRoot)
    ├── App.tsx                     # componente raiz / orquestração de estado
    ├── App.css / index.css         # estilos
    ├── components/
    │   ├── VideoCanvas.tsx         # <video> + <canvas> de overlay da webcam
    │   └── StatusPanel.tsx         # painel de controle e status de postura
    ├── hooks/
    │   ├── usePoseTracking.ts      # integração com @mediapipe/pose + camera_utils
    │   └── usePostureAlerts.ts     # disparo de alertas sonoros com cooldown
    ├── utils/
    │   ├── postureAnalysis.ts      # regras de negócio: métricas, baseline, desvios
    │   ├── geometry.ts             # funções matemáticas puras (distância, ângulos)
    │   └── alerts.ts               # beep via Web Audio API
    └── types/
        └── posture.ts              # tipos e constantes compartilhadas
```

Veja também: [Visão Geral e Arquitetura](./arquitetura.md), [Fluxo de Detecção de Postura](./fluxo-postura.md), [Bibliotecas e Referências](./bibliotecas.md).
