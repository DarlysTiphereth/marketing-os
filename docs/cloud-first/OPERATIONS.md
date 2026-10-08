# Operação do control plane

Runtimes: Node 24.19 / pnpm 11.25 do runtime Codex (`%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\`); FFmpeg e Chrome headless do media-stack-lab. Sobrescreva com `MOS_FFMPEG`, `MOS_FFPROBE`, `MOS_CHROME`, `MOS_HOME`.

## Comandos

```bash
node ops/cli.ts status
```
Mostra limites, disponibilidade de cada worker (com evidência), fila e uso do CAS.

```bash
node ops/cli.ts enqueue --creative experiments/remotion/creatives/fixture.creative.json --public-safe --sel hook=hook-a2 --sel body=body-1 --sel cta=cta-a --sel style=fixture-grey --sel voice=none --sel pacing=standard --sel captions=off
```
Cria (ou reaproveita, se idêntico) um job. `--public-safe` só para conteúdo sem dados de marca.

```bash
node ops/cli.ts dispatch <job-id>
```
Tenta o primeiro worker gratuito disponível. Se nenhum estiver disponível, o job continua `QUEUED`.

```bash
node ops/cli.ts dispatch <job-id> --allow-local
```
Permite o fallback local (prioridade baixa, exige ≥ 1,5 GiB de RAM livre).

```bash
node ops/cli.ts dispatch <job-id> --prefer colab
```
Gera instruções para o notebook Colab; o job fica `AWAITING_MANUAL` até `complete`.

```bash
node ops/cli.ts poll <job-id>
```
Lê o resultado de um job remoto pela API pública do GitHub (anotação `MOS_METRICS`).

```bash
node ops/cli.ts storage plan --include-external
```
Lista o que a retenção moveria para a quarentena. Não altera nada.

```bash
node ops/cli.ts storage apply --approve
```
Move para a quarentena (reversível com `storage restore <lote>`).

```bash
node ops/cli.ts storage approve <sha256> --name <nome>
```
Protege uma versão aprovada para sempre.

Medição de qualquer comando:

```bash
node ops/bench/measure.ts --label meu-teste --watch .mos -- node experiments/remotion/pipeline/produce.ts --creative creatives/fixture.creative.json --hook hook-a2 --body body-1 --cta cta-a --style fixture-grey --voice none
```

## Fábrica estática

```bash
node factories/static/src/produce.ts --brief briefs/grand-sabao-5l.brief.json
```
Gera A–E + variações a partir de um briefing; saída em `factories/static/runs/<run>/` (`final/`, `source/`, `index.html`, `manifest.json`, `qc.json`, `variants.json`). Os assets da marca precisam existir localmente (são verificados por SHA-256).

## Testes

```bash
npm test
```

```bash
node --test ops/tests/ops.test.ts
```

```bash
node --test factories/static/tests/static.test.ts
```

## Regras operacionais
- Nada pago: o scheduler recusa workers não gratuitos; nenhum serviço é contratado ou habilitado.
- Colab: só uso interativo iniciado por você; um job por sessão; nunca servidor, nunca execução agendada ou automatizada.
- Codex Cloud: tarefas de engenharia e revisão; render só se você iniciar a tarefa manualmente.
- Publicação: nenhuma peça é publicada; tudo sai como `PENDING_HUMAN_REVIEW`.
- Repositório público: nenhum asset, imagem ou vídeo de marca é enviado ao GitHub.
