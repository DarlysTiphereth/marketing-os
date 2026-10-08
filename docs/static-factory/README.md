# Static Creative Factory — prova funcional 001

Status: **funcional, PENDING_HUMAN_REVIEW**. 16 peças GRAND geradas de um único briefing em ~12 s, US$ 0, sem GPU. Nada publicado.

## 1. Auditoria do que já existia e integração mínima

| Já existia | Reaproveitado como |
|---|---|
| Núcleo v0.1 (`src/`): claims com `source_ids`, compliance, budgets, matriz de variantes, manifests | **não alterado**; mesma regra "no source → no claim" aplicada no briefing estático |
| `creative.v1` + variant engine do vídeo (`experiments/remotion`) | mesma lógica de dimensões independentes; claims do produto movidos para a Product Database compartilhada |
| Assets reais GRAND (packshot 800 px com alfa, rótulo, crops do logo/ícones) | Asset Library por SHA-256 (`factories/shared/products/grand/…`) |
| Chrome headless + FFmpeg locais | renderer (Playwright) e exportação JPG/WebP |
| `ops/` (CAS, retenção, fila, medidor) | saídas viram objetos `candidate` no CAS; mesma retenção e aprovação |

Integração nova, mínima:
- `factories/shared/brand-kits/grand/kit.json` — logotipo (por hash), paleta (derivada do rótulo, marcada como não oficial), tipografia (Archivo Variable, OFL, eixos de largura e peso), elementos, tom, regras de compliance, versões aprovadas.
- `factories/shared/products/grand/sabao-liquido-premium-5l.json` — fatos, 10 claims com fonte e status de aprovação, assets por hash, modo de uso.
- `factories/static/` — `core.ts` (formatos, contraste WCAG, claims, variantes), `templates.ts` (4 conceitos + foto composta), `carousel.ts` (carrossel + stories), `render.ts` (Playwright, QC, exportação), `produce.ts`.

## 2. Design Intelligence
Quatro conceitos de direção de arte com composição, grid, escala tipográfica e luz próprios (não troca de cor):

| Conceito | Composição | Uso |
|---|---|---|
| Hero Spotlight | estúdio escuro, um feixe de luz, produto como sujeito único sobre piso brilhante com reflexo; título expandido centralizado | marca, premium |
| Editorial Split | grid assimétrico; coluna tipográfica à esquerda com benefícios e ícones reais do rótulo; produto num campo de cor | benefícios, explicação |
| Bold Block | blocos de cor, numeral "5L" gigante atrás do produto, adesivo de CTA | promocional sem preço |
| Catalog Clean | branco, produto dominante, ritmo de especificações; versão sem texto para marketplace | catálogo, marketplace |

Hierarquia tipográfica com uma única família variável: display (largura 125, peso 800), headline (112/750), corpo (100/450), rótulos (110/650, caixa alta, tracking 0,14 em). Títulos longos reduzem de tamanho automaticamente para evitar viúvas.

## 3. Variant Engine
1 produto × 4 conceitos × 3 headlines × 2 CTAs × 3 formatos = **72 combinações**. Seleção gulosa por máxima diversidade (peso: conceito 4, headline 2, CTA 1, formato 1), desempate por adequação conceito×formato e por claims já aprovados. Renderizadas: 6 da seleção + as 3 variações do melhor anúncio. `variants.json` registra as 72 com score e seleção.

## 4. Entregáveis da prova (GRAND Sabão Líquido Premium 5 L)

| Pedido | Peça | Formato | QC |
|---|---|---|---|
| A. Fotografia comercial composta | `A-photo-composite` (sem texto, estúdio, piso brilhante, gotas, reflexo) | 1080×1350 | PASS |
| A (extra) marketplace | `A2-marketplace-main` (branco puro, sem texto) | 1200×1200 | **WARN**: packshot ampliado 1,32× |
| B. Anúncio de performance | `B-best-hero-spotlight-h1-cta1-feed_4x5` | 1080×1350 | PASS |
| C. Carrossel 5 páginas | `C-carousel-01…05` + `C-carousel.pdf` (hook → problema → solução → como usar → CTA, fundo contínuo) | 1080×1350 | PASS ×5 |
| D. Stories promocional | `D-story-promo` (sem preço: oferta UNKNOWN) | 1080×1920 | PASS |
| E. 3 variações do melhor | `E-variation-editorial-split`, `-bold-block`, `-catalog-clean` | 1080×1350 | PASS ×3 |
| Variantes diversas | 4 peças `V-*` (square, story, feed) | vários | PASS |

Exportação: PNG, JPG, WebP de todas; PDF do carrossel; HTML-fonte editável por peça. **SVG não gerado**: os templates são HTML/CSS; exportar SVG verdadeiro exige reescrever em SVG puro (não implementado).
Rotulagem: as composições estão marcadas `SYNTHETIC_COMPOSITE` no manifest — composição digital com a foto real do produto, não fotografia de estúdio.

## 5. Quality Control
Automático, medido no layout real da página: texto fora do quadro, margens/zonas seguras por formato, sobreposição entre textos, **texto sobre a embalagem** (regra estrita), contraste WCAG por par cor/fundo declarado, corpo mínimo, ampliação do packshot (pixelização), proporção do logotipo, densidade de texto, fonte carregada, assets carregados, layouts repetidos (dHash entre conceitos e páginas), claims sem fonte (bloqueia o render).

Histórico de ciclos (todos registrados em `factories/static/runs/`):
1. 10/16 reprovadas — benefícios sobre o galão, adesivo fora da zona segura, especificações colidindo com o CTA, contraste 4,09, falso positivo de fonte em peças sem texto.
2. 2/16 — adesivo de Stories na faixa inferior coberta pela interface, contraste 4,48.
3. 0/16 no automático, mas **a revisão visual reprovou 4**: alça do galão cruzando o título (o limite de 8% deixava passar), rótulos colidindo na página 3, viúva tipográfica, página 2 vazia → regra de sobreposição endurecida e layouts corrigidos.
4. Ajuste de direção de arte: produto maior no hero; a faixa deixou de repetir o claim do título.

Revisão visual humana continua obrigatória antes de aprovar (`storage approve`).

## 6. Comparação com práticas profissionais do mercado (sem copiar peças)
Critérios observados em anúncios premium de lavanderia/limpeza, avaliados pelo agente (INFERRED, não pesquisa de público):

| Prática | Nossa prova |
|---|---|
| Um ponto focal: embalagem como herói, grande e nítida | ✅ B, A, E; ⚠️ marketplace limitado pela resolução do packshot |
| Luz de estúdio com direção (recorte, reflexo, sombra de contato) | ✅ A e B; ⚠️ é luz desenhada em CSS — falta a textura de uma foto de estúdio real |
| Motivo de água/líquido ligado ao produto | ✅ ondas, cáusticas, gotas; ⚠️ gotas pequenas lidas como brilho, não como água |
| Título curto (≤ 6 palavras) + 1 benefício + 1 CTA | ✅ |
| Prova (selo, teste, avaliação) | ❌ inexistente por decisão: nenhuma prova verdadeira foi fornecida |
| Lifestyle (roupas, lavanderia, mãos) | ❌ não há fotografia/footage real; não foi simulado |
| Consistência de marca entre formatos | ✅ mesma família tipográfica, paleta e elementos do rótulo |

Leitura honesta: a fábrica produz peças limpas e consistentes de nível "e-commerce/social profissional", **não** fotografia publicitária de estúdio. O teto é dado pelos insumos: packshot de 800 px, ausência de fotos de uso e de provas.

## 7. Custo e consumo (MEASURED)
16 peças: 12–13 s, pico de 364 MB de RAM, 5,4 cpu·s, GPU 0, ~20 MB de arquivos finais (PNG/JPG/WebP/PDF). US$ 0. É leve o bastante para rodar localmente; remoto quando houver executor.

## 8. Limitações e próximos passos
- Claims do rótulo seguem `SOURCED_PENDING_APPROVAL` (o manifest lista quais).
- Packshot em alta resolução é o maior ganho de qualidade disponível (marketplace e hero maiores).
- Remoção de fundo: o packshot já tem alfa; para fotos novas sem alfa, remoção open-source (ex.: rembg/U²-Net) só em executor remoto — **NOT_IMPLEMENTED**.
- Presets de formato marcados VERIFY (sem documentação oficial acessível).
- Estruturas de carrossel "comparativo" e "dicas" exigem provas/fontes e ficam bloqueadas até existirem.
