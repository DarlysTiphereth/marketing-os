# Validação do incremento Universal Assets

Execução local Windows / Node 24.19.0 em 2026-10-08. `npm` não estava no PATH; usado o equivalente pnpm previsto no AGENTS.md, sem instalar ferramenta nova.

| Gate | Resultado |
|---|---|
| `pnpm run build` | PASS |
| `pnpm run validate:skills` | PASS 7/7 |
| `pnpm test` | PASS 88/88, 0 falhas, 0 skips |
| `node --test ops/tests/ops.test.ts` | PASS 12/12 |
| `node --test factories/static/tests/static.test.ts` | PASS 6/6 |
| Total das três suítes presentes nesta branch | 106/106 PASS, 0 FAIL |
| `node scripts/ci-smoke.mjs` | PASS 5/5, incluindo replay obsoleto exit 3 |
| `node scripts/assert-fixture-eol.mjs` | PASS 10 fixtures com hashes exatos |
| `git diff --check` | PASS |
| `node universal-assets/benchmark.mjs` | Três MP4 de 6s, QC técnico medido PASS |
| `node universal-assets/review.mjs` | Board, storyboards e comparação com arquivo rejeitado verificados por hash |

17 testes novos em `tests/universal-assets.test.ts`: seleção determinística e stale binding; direitos/custo/prazo/retenção/faceless; stock versus evidência; escopo/produto/versão/claims; matching cinematográfico; reutilização com aprovação por hash/escopo; capacidades pagas/locais/sem quota; aquisição materializada e verificação; portas de factories; embalagem autêntica em composição; replay após expiração; cadeia de composição também no reuse; IDs/estratégias inválidos; bytes/licença/paths/limites; ausência de chave e pedido humano; crédito/cache/rate limit/redação de secrets; cache vencido e hosts hostis.

Os testes usam respostas HTTP contratuais, não comprovam acesso live às APIs. Duas falhas de integração detectadas durante implementação foram corrigidas: sintaxe de parameter properties incompatível com type stripping do Node e caminho da fonte com `@` rejeitado pelo validador relativo. Os gates finais foram executados após essas correções. A renderização também passou a consumir fontes vinculadas ao plano, com anotação distinta de água e tecido, em vez de ignorar o resultado do roteador.

O total não inclui os testes de comércio do PR #1 porque o módulo continua naquela branch isolada. Nenhum código anterior foi descartado, nem dist residual de outra branch contado como teste presente. Testes e QC técnico não constituem aprovação criativa ou comercial.

Dados sensíveis: presença de chaves de Pexels/Pixabay verificada como falsa, sem exibir valores; varredura dos arquivos novos sem credenciais reais. `C:/Users/local` aparece exclusivamente como entrada negativa sintética do teste de path traversal. MP4/PNG/áudio reais permanecem ignorados em `.mos/`; arquivos temporários, modelos, node_modules, dist e outputs não entram no commit. Registro de licença é observação de fontes oficiais, não certificado inventado.

CI remoto: acompanhar o run do novo PR após push. Runs anteriores estavam bloqueados pelo GitHub por billing, antes de qualquer step. Não atribuir falha futura a código sem ler annotations e não declarar CI PASS a partir desta validação local.
