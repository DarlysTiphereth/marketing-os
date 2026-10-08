# Stack D — Hybrid best-of-breed

**Status: PARCIAL.** O núcleo (creative.v1 → variant engine → timeline → Remotion → FFmpeg → QC) está implementado e medido em `experiments/remotion`. O que falta para ser "híbrido" de fato é o **asset router com providers pagos**, que exige chaves + aprovação de custo (não existe `.env` nesta máquina).

## Desenho
Por cena, `visual_type` → fonte:
| visual_type | fonte preferida | fallback | custo |
|---|---|---|---|
| product_hero / cta_card / benefit_stack | packshot real + Remotion | — | $0 |
| kinetic_type / step_cards / motion_graphic | Remotion procedural | — | $0 |
| illustration (problema) | **AI image-to-video curto (3–5 s) ou stock real** | procedural (atual) | $–$$ |
| demo real (roupa lavando, tecido) | stock licenciado ou filmagem própria | AI video | $0–$$ |
| voz | TTS premium (ElevenLabs/OpenAI) | OneCore local | ¢ |

## Experimento proposto (aguarda aprovação — ver final-recommendation.md)
Substituir **apenas 2 cenas** do hero (hook-a e b1-problem, hoje ilustrações vetoriais) por clipes reais/AI e trocar a voz por TTS premium, mantendo todo o resto idêntico. Isso isola o efeito de "AI como asset generator" contra o Remotion-first puro.
