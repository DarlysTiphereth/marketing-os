# Validação local — Dual Commerce

Executada em Windows / Node 24.19.0, em 2026-10-08. Base anterior preservada: `011fcd3`. Relatório completo do benchmark sem mídia privada em `BENCHMARK.json`; artefatos privados em `.mos/commerce`.

| Gate | Resultado |
|---|---|
| `pnpm run build` | PASS |
| `pnpm run validate:skills` | 7/7 PASS |
| `pnpm test` | 101 total, 101 PASS, 0 FAIL, 0 skipped/cancelled/todo |
| `node --test ops/tests/ops.test.ts` | 12 total, 12 PASS, 0 FAIL |
| `node --test factories/static/tests/static.test.ts` | 6 total, 6 PASS, 0 FAIL |
| `node scripts/ci-smoke.mjs` | PASS: GRAND, replay idêntico, SafeZone, stale exit 3, replay restaurado |
| `node scripts/assert-fixture-eol.mjs` | PASS: 10 fixtures textuais, atributos/index/hashes |
| `git diff --check` | PASS |
| Typecheck estrito separado de `commerce/benchmark.ts` | PASS, contratos completos de timeline/voz |
| `node --experimental-strip-types commerce/benchmark.ts` | PASS: dois MP4 + dois PNG, dois pacotes separados BLOCKED |

Total automatizado: **119 testes, 119 PASS, 0 FAIL**. Os 63 testes anteriores do monólito foram mantidos e 38 testes novos foram adicionados. Cobertura: schemas/IDs/campos inesperados, isolamento de listings/contas/ranking, comissão inteira/limites, margem desconhecida/negativa, variantes determinísticas, metadata fora do conteúdo, claims/traduções aprovados, ofertas, governança/fingerprint/hashes de mídia, simulação sem publicação, capacidades NOT_SUPPORTED, atribuição segregada, cancelamentos, duplicação, snapshots cumulativos, HTML seguro, estados de publicação e contratos de mídia.

Os pilotos têm 18 segundos, 1080×1920, 30fps, 540 frames, H.264 yuv420p e AAC estéreo 48kHz. QC mede loudness, peak, resolução, duração, fps, frames pretos, freeze, silêncio e caixas de layout. Loudness final: -14.1 LUFS nos dois; true peak GRAND -1.5dBTP / MOCK -1.3dBTP. Sem FAIL no QC final. Há áudio procedural, sem voz/testemunho humano simulado.

O primeiro render falhou em margem do estático e o segundo em loudness -15.1 LUFS. Corrigidos espaçamento e ganho de áudio no novo benchmark; nenhum limite foi relaxado. Regras estáticas herdadas específicas de `Ad.tsx`/jug foram substituídas por medição das caixas reais deste template, preservando os gates técnicos comuns. Imagens e amostras dos MP4 foram inspecionadas; aprovação visual/regulatória para publicação permanece pendente.

Dados comerciais GRAND não disponíveis continuam UNKNOWN/null. Afiliado, valor e comissão são fictícios e rotulados MOCK. Reports de performance não contêm eventos nem pedidos reais: `NO_OBSERVATIONS`; criativos `NOT_VALIDATED_BY_SALES`. Arquivos renderizados não demonstram conversão, validação comercial ou escala bilionária.

Nenhuma API paga, GPU, contratação, transação ou publicação usada. Fallback CPU local explícito: tempo final do benchmark registrado em BENCHMARK.json. Zero de gasto contratado adicional; energia/CPU não foram medidos como faturamento.

Revisão independente Codex de `936cd65`: dois P1 (ranking entre scopes e labels de fixtures) e dois P2 (aprovação sem hashes de mídia e score penalizando unknown). Re-review de `faaa1cc`: três P2 (conversões acima de cliques, PREPARED contraditório e IDs filhos duplicados). Os sete findings receberam correção e regressão neste incremento. Validação extra corrigiu timeline/voz incompletos e validou governança runtime/disclosures localizados.

Entrada de vídeo usa JPEG codificado por Chrome Canvas, com comparação RGB PNG→JPEG (PSNR >=35dB). O MP4 decodificado é comparado à referência nos headers/footers das três cenas, ambos normalizados para BT.709 em faixa limitada yuv420p (seis gates adicionais por vídeo, PSNR >=35dB). A conversão preserva o PNG estático original; gates de codec/áudio não foram relaxados. Uma aparente corrupção de texto na prévia JPEG foi conferida com o decoder independente do Chrome: o texto estava íntegro. Não foi comprovado defeito no decoder PNG do FFmpeg. Essa verificação mede fidelidade da amostra; não equivale a validação de vendas ou aprovação editorial final.

CI remoto bloqueado por billing: tentativa 4 antiga e run de PR #6 `37798654597`, ambos com os quatro jobs sem step/runner e mesma anotação de account lock. Isso é uma limitação externa; testes locais não são substitutos de resultado remoto PASS. Workflow existente preservado. Novos testes entram automaticamente em seu `pnpm test`.
