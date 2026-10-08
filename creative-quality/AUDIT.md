# Auditoria dos vídeos rejeitados

Inspeção em 2026-10-08. MP4 efetivos, não screenshots dos templates. `review-board.mjs` registra hashes e extrai 0s, 0,5s, 1s e frames posteriores em `audit-inventory.json`. Filmstrips completos privados no board. Não foram atribuídas notas numéricas: todos os pilotos permanecem **REJEITADOS**; nenhum resultado mediano recebe PASS criativo.

## Pilotos GRAND Seller / Affiliate MOCK — 18s

| Dimensão | Defeito concreto observado | Consequência |
|---|---|---|
| Abertura | “Conheça o produto” e mesma estrutura no primeiro frame de ambos. | Pode anunciar qualquer SKU; nenhuma razão específica para continuar. |
| Primeiro segundo | 0s/0,5s/1s repetem packshot e layout. Só há movimento na janela de stock. | Sem progressão visível do argumento; falta gesto forte ou tensão inicial. |
| Direção de arte | Navy, arco decorativo e borda azul ocupam grande parte do quadro. | Apresentação de catálogo com video inset, sem fotografia dirigida. |
| Composição | Stock é janela 450×380, aproximadamente 8,2% do quadro 1080×1920; restante predominantemente fundo/UI. | A ação é pequena em tela de celular e compete com duas áreas de texto. |
| Identidade | Mesma moldura para produto próprio e pano desenhado MOCK. | Trocar o produto basta para repetir a peça; identidade reduzida a cor. |
| Realismo | GRAND é um recorte 2D isolado; MOCK é SVG declarado fictício. | Nenhum dos dois demonstra volume/cena física ou material do produto em uso. MOCK serve como fixture, não referência publicitária. |
| Demonstração | GRAND alterna bacia, máquina industrial e tecido. MOCK usa máquina/denim/mãos, sem mostrar o pano fictício em ação. | Não há vínculo verificável entre produto, gesto e resultado. Stock não prova eficácia. |
| Narrativa | Três blocos uniformes de 6s: descoberta, nome/detalhes, CTA. | Mudam o texto e a janela; não há problema, mecanismo e payoff visuais. |
| Edição | Jump entre ações/lugares diferentes; sem continuidade do mesmo uso. | Montagem de exemplos da categoria, não demonstração causal. |
| Sound design | Procedural bed e efeitos genéricos; os takes de mãos/máquina não têm áudio original. | Áudio acompanha a timeline, não comunica textura física captada. Não afirmar escuta humana aprovada. |
| CTA | “Veja os detalhes” sobre tecido; sem oferta/conta/preço verificado. | Ação vaga e sem destino comercial demonstrado. Não inventar preço/urgência para resolver. |
| Retenção | Hook genérico, exposição de 6s por bloco e baixa área de ação. | Risco editorial de abandono; retenção real UNKNOWN, não foi medida. |
| Clareza comercial | Metadata Seller/Affiliate está correta, mas a imagem não explica uma vantagem/oferta específica. | Integridade dos ledgers não torna a proposta persuasiva. |

## Cinematográfico anterior — 23,5s

Arquivo `experiments/remotion/cinematic/runs/2026-10-08T02-36-26-994Z_01884224a7/final.mp4`, hash `e0534ff5301c6ac1d9cc5cf8561c61d30142d55439e8f173d1727fa9986a4b2f`.

No primeiro segundo, tinta azul em água ocupa a abertura; pode parecer filme de líquido, mas a fonte é **tinta**, não detergente GRAND. A identificação do frasco não aparece na abertura; o hero está no último bloco, a partir de 17,5s. Planos seguintes alternam máquina industrial, mãos, denim e varal em cenários/luzes distintos. Existe imagem fotográfica, porém sem continuidade de produto/aplicação ou resultado. O hero com cáusticas e recorte tem identidade reconhecível, mas o frasco continua 2D; sombra/reflexo não equivalem a filmagem de estúdio.

Há copy de uso e resultados no EDL (“Puro ou diluído”, roupas perfumadas etc.) cujo cadastro atual está `SOURCED_PENDING_APPROVAL`. Isso é defeito de seleção/compliance além de criação: rótulo consultado não equivale a autorização do claim para essa peça. O incremento novo não altera o vídeo histórico e usa somente copy atualmente aprovada. A promessa e a cor não podem converter tinta em prova de detergente.

## GRAND com desenhos — Benchmark 001

Arquivo `experiments/remotion/runs/2026-10-08T00-47-22-459Z_v-31bf548c4d26/final.mp4`. O cadastro identifica GRAND, mas o mundo físico foi substituído por objetos/tecidos ilustrados, bubbles e tipografia. A inspeção dos frames distingue essa peça da fixture tecnológica “TEST BRAND”; esta última não é usada como anúncio GRAND na comparação final.

O problema é de linguagem/material: animação pode servir a explicação, porém não substitui demonstração ou fotografia publicitária. Repetir zoom no packshot não cria ângulos novos. Voz Maria/TTS e copy da timeline não são experiência de consumidor; o áudio exige escuta humana, e não deve ser validado apenas pela presença de stream AAC.

## Criativo versus tecnológico

- **Criativo/material:** hook intercambiável, pequena ação em quadro, hierarquia pesada, sem continuidade/demonstração, falta de textura dirigida, frasco recortado, trilha genérica, ausência de oferta comprovada. Trocar codec ou ferramenta não resolve.
- **Tecnológico/governança:** o sistema representava “QC PASS” sem exigir cinco decisões independentes; métricas de layout, loudness e frames não aferem desejo, naturalidade, identidade ou argumentação. A camada nova deixa aprovação criativa/humana pendente mesmo com render íntegro.
- **Não comprovado:** falha de decoder do MP4 como causa da rejeição. Uma prévia JPEG exibiu trechos incompletos, mas a redecodificação pelo Chrome mostrou texto íntegro. Não atribuir ao codec a deficiência publicitária.

## Julgamento das duas novas amostras

A: produto desde o primeiro frame; água em movimento ocupa o fundo todo; copy tem menos blocos; corte para tecido em 2,2s e retorno em 3,6s. A embalagem ainda é uma composição 2D e seu cenário não tem contato físico verificável. A luz/fotografia limitada do packshot é o teto principal. Não classificar como filme de estúdio aprovado.

B: mãos e água ocupam tela inteira; cortes em 2,4s e 4,6s seguem a mesma atividade; luz/pele/tecido são fotográficos. O fundo não foi dirigido, o produto usado não é identificado e o Foley não foi captado com o take. A melhora de clareza de ação não resolve eficácia, autoria UGC ou relação com GRAND.

O painel compara 0,5s de cada peça sem escolher um frame favorável diferente para a nova. Storyboards mostram também 2,7s/4,2s/6,7s. Essas evidências permitem julgamento humano; não comprovam retenção, conversão ou padrão de agência. O usuário decide rejeitar, ajustar ou aprovar a evolução dos conceitos, antes de qualquer anúncio completo.
