# Plano de migração (sem perda de dados) e estratégia de retenção

## Migração — fases

Cada fase é reversível e não apaga nada por conta própria.

| Fase | Ação | Quem | Estado |
|---|---|---|---|
| 0 | Auditoria e medição local (`docs/cloud-first/AUDIT-AND-BENCHMARK.md`) | agente | **feito** |
| 1 | Control plane `ops/` + CAS + retenção + fila; pipelines gravam em `.mos/` (gitignored) | agente | **feito** |
| 2 | CI leve (1 job em push, matriz em PR) e `render-job.yml` | agente | **feito** (aguarda billing) |
| 3 | **Resolver o billing lock da conta GitHub** (configurações de cobrança da conta). Repositório público → minutos dos runners padrão são gratuitos; não é preciso cadastrar cartão para isso se o bloqueio for de pendência antiga — confirme no aviso da conta | **você** | pendente |
| 4 | Primeiro job remoto do fixture: `node ops/cli.ts dispatch <job>` → `poll` → comparar `output_sha256`/métricas com o Benchmark A | agente | pronto para rodar |
| 5 | Conteúdo de marca remoto: exige **repositório privado** (cota gratuita de minutos/armazenamento do plano Free) ou Colab manual com upload na sessão. Nunca no repositório público | você decide | não iniciado |
| 6 | Revisar `storage plan --include-external` após 24 h e aprovar a quarentena dos vazamentos antigos; remover `node_modules/.remotion` (283 MB) manualmente se aprovar | você | pendente |
| 7 | Lab `C:\Projects\media-stack-lab`: manter Chrome/FFmpeg como runtime até a fase 4 estar estável; depois decidir arquivar o OpenMontage (826 MB) | você | não iniciado |

Preservação: nenhum arquivo existente foi removido; o lab não foi modificado; o núcleo v0.1 (`src/`, `tests/`) não mudou e continua 63/63.

## Retenção de vídeos e imagens

| Classe | Exemplos | Onde | Regra |
|---|---|---|---|
| `temp` | frames JPEG, premix WAV, pasta pública preparada, workdirs | `.mos/tmp` | apagados no fim do run; sobras > 24 h vão para quarentena (com aprovação) |
| `cache` | bundles Remotion, assets de marca materializados, TTS | `.mos/cache`, CAS | TTL 14 dias; LRU acima de 1,5 GB (`MOS_CACHE_MAX_BYTES`) |
| `candidate` | MP4/PNG renderizados, ainda não aprovados | CAS + hardlink no run | TTL 30 dias sem acesso |
| `approved` | versões aprovadas por você (`storage approve <sha>`) | CAS | **nunca** entram no plano de limpeza |
| remoto | artifacts do Actions | GitHub | retenção 3 dias (só fixtures públicos) |
| Git | código, schemas, manifests, qc.json, creative.json, fixtures sintéticos | GitHub | permanente; **nenhum MP4/JPG/PNG de marca** (`.gitignore`) |

Fluxo de exclusão: `storage plan` (só lista) → `storage apply --approve` (move para `.mos/quarantine/<lote>` e grava `restore.json`) → `storage restore <lote>` desfaz → `storage purge --i-approve-irreversible-delete` só remove lotes com mais de 7 dias.
