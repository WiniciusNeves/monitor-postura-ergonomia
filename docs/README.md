# Documentação — Monitor Inteligente de Postura e Ergonomia

Índice da documentação do projeto (Computação Gráfica e Realidade Virtual · Projeto A3).

- [Visão Geral e Arquitetura](./arquitetura.md) — o que o sistema faz e como os módulos se conectam.
- [Bibliotecas e Referências](./bibliotecas.md) — dependências externas, por que foram escolhidas e links oficiais.
- [Fluxo de Detecção de Postura](./fluxo-postura.md) — pipeline de captura de vídeo, extração de landmarks, cálculo de métricas e geração de alertas.
- [Estrutura do Projeto](./estrutura.md) — mapa de pastas e arquivos-fonte.

## Como rodar o projeto

```bash
npm install
npm run dev      # ambiente de desenvolvimento
npm run build     # build de produção (tsc -b && vite build)
npm run preview   # preview do build de produção
npm run lint      # oxlint
```

Requer câmera web e navegador com suporte a `getUserMedia` e Web Audio API.
