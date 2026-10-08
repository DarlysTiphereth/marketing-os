# Validação local — Dual Commerce

Executada em Windows / Node 24.19.0, em 2026-10-08. Base anterior preservada: `011fcd3`. Relatório completo do benchmark sem mídia privada em `BENCHMARK.json`; artefatos privados em `.mos/commerce`.

| Gate | Resultado |
|---|---|
| `pnpm run build` | PASS |
| `pnpm run validate:skills` | 7/7 PASS |
| `pnpm test` | 93 total, 93 PASS, 0 FAIL, 0 skipped/cancelled/todo |
| `node --test ops/tests/ops.test.ts` | 12 total, 12 PASS, 0 FAIL |
| `node --test factories/static/tests/static.test.ts` | 6 total, 6 PASS, 0 FAIL |
| `node scripts/ci-smoke.mjs` | PASS: GRAND, replay idêntico, SafeZone, stale exit 3, replay restaurado |
| `node scripts/assert-fixture-eol.mjs` | PASS: 10 fixtures textuais, atributos/index/hashes |
| `git diff --check` | PASS |
| `node --experimental-strip-types commerce/benchmark.ts` | PASS: dois MP4 + dois PNG, dois pacotes separados BLOCKED |

Total automatizado: **111 testes, 111 PASS, 0 FAIL**. Os 63 testes anteriores do monólito foram mantidos e 30 testes novos foram adicionados. Os testes novos cobrem schemas/IDs/campos inesperados, oito dimensões de isolamento de listings, identidade de conta/oferta, comissão inteira e limites, margem desconhecida/negativa, três variantes determinísticas, metadata fora do conteúdo, claims/traduções aprovados, seleção de ofertas, governança/fingerprint, simulação sem publicação, capacidades NOT_SUPPORTED, atribuição segregada, cancelamentos, duplicação, snapshots cumulativos, HTML seguro e contratos de mídia.

Os pilotos têm 18 segundos, 1080×1920, 30fps, 540 frames, H.264 yuv420p e AAC estéreo 48kHz. QC mede loudness, peak, resolução, duração, fps, frames pretos, freeze, silêncio e caixas de layout. Loudness final: -14.1 LUFS nos dois; true peak GRAND -1.5dBTP / MOCK -1.3dBTP. Sem FAIL no QC final. Há áudio procedural, sem voz/testemunho humano simulado.

O primeiro render falhou em margem do estático e o segundo em loudness -15.1 LUFS. Corrigidos espaçamento e ganho de áudio no novo benchmark; nenhum limite foi relaxado. Regras estáticas herdadas específicas de `Ad.tsx`/jug foram substituídas por medição das caixas reais deste template, preservando os gates técnicos comuns. Imagens e amostras dos MP4 foram inspecionadas; aprovação visual/regulatória para publicação permanece pendente.

Dados comerciais GRAND não disponíveis continuam UNKNOWN/null. Afiliado, valor e comissão são fictícios e rotulados MOCK. Reports de performance não contêm eventos nem pedidos reais: `NO_OBSERVATIONS`; criativos `NOT_VALIDATED_BY_SALES`. Arquivos renderizados não demonstram conversão, validação comercial ou escala bilionária.

Nenhuma API paga, GPU, contratação, transação ou publicação usada. Fallback CPU local explícito: tempo final do benchmark registrado em BENCHMARK.json. Zero de gasto contratado adicional; energia/CPU não foram medidos como faturamento.

O CI remoto anterior continua bloqueado por billing, inclusive tentativa 4 (quatro jobs sem step/runner). Isso é uma limitação externa; testes locais não são substitutos de um resultado remoto PASS. O workflow existente não foi modificado. Novos testes entram automaticamente em seu `pnpm test`.
