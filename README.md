# Marketing OS — Foundation v0.1

Vertical slice local e verificável: produto → provenance → compliance → estratégia → matriz → variantes → manifestos → QA → custo/eficiência → READY_FOR_PRODUCTION.

Os dados são **TEST_FIXTURE / NOT_REAL_PRODUCT_DATA**. Os nomes das marcas vieram do pedido; tom, defaults e conteúdo são configurações de teste. Nenhuma mídia, chamada de IA ou publicação acontece. READY_FOR_PRODUCTION significa planejamento aprovado pelo QA, sem autorização para publicar.

## Executar

Node >=22.18. Instale com `pnpm install --frozen-lockfile` (lockfile canônico) ou `npm install` em ambientes com npm.

```bash
npm run build
npm test
npm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5
```

Equivalente com pnpm:

```bash
pnpm run build
pnpm test
pnpm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5
pnpm run generate -- --brand safezone --product test-product --budget 5
```

Neste ambiente o npm não está no PATH. O pnpm usado na validação fica em `C:\Users\work study\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd`.

Execução direta, depois de instalar:

```bash
node --experimental-strip-types src/cli/generate.ts --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5
```

Flags: `--angles 1..3`, `--hooks 1..3`, `--visuals 1..2`, `--budget >=0`, `--currency BRL|USD|EUR`, `--platform tiktok|instagram|youtube`, `--tier TEMPLATE`, `--idempotency-key`, `--root`, `--output` relativo ao root. Formato VIDEO; specs 9:16, 1080×1920, 18s, 30fps, texto/legenda, sem áudio obrigatório. Escopo máximo atual: 18 variantes/batch.

Saídas: código 0 = planning ready; 1 = entrada/execução inválida; 2 = batch retido por compliance/QA. Logs JSON vão para stderr; resumo vai para stdout. `--help` exibe opções.

## Idempotência e evidência

O default da CLI deriva a chave do pedido validado. Mesma chave por marca retorna o batch completo existente, inclusive após reiniciar. Pedido diferente com a mesma chave falha com IDEMPOTENCY_CONFLICT. Para uma nova versão de dados/estratégia, use uma nova chave explícita. Repetir um pedido retorna o snapshot original: não atualiza o batch.

UUIDs v5 derivam do batch e das decisões; contagem, ordem e conteúdo são determinísticos. Timestamps e correlation_id identificam a primeira execução. Aliases de decisões equivalentes são deduplicados por conteúdo + versão de template.

Cada batch em `outputs/<uuid>/` contém os nove relatórios/dados solicitados, 18 manifestos para GRAND, snapshots de marca/assets/compliance/ledger e checksums em `integrity.json`. Gravação por staging + rename evita retornar batches parciais. Saídas e build são ignorados pelo Git e regeneráveis.

As fontes locais são envelopes JSON de evidência, com `brand_id`, `product_id` e `facts[]`; hashes são conferidos. Claims carregam `source_ids[]`. O registry contém um template de planejamento sintético por marca, sem imagem/vídeo.

## Revisão

- [Relatório final](docs/FINAL_REPORT.md)
- [Brief independente](docs/review/CLAUDE_REVIEW_BRIEF.md)
- [Rastreabilidade de todos os requisitos](docs/review/REQUIREMENTS_TRACEABILITY.md)
- [Testes e gates](docs/review/TEST_REPORT.md)
- [Limitações e dívida técnica](docs/review/KNOWN_LIMITATIONS.md)
- [Dados reais necessários da GRAND](docs/GRAND_DATA_NEEDED.md)

Pare na v0.1. Próximo passo autorizado pelo escopo é entregar para revisão independente.
