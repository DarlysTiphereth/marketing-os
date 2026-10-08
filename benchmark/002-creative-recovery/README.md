# Benchmark 002 — Creative Quality Recovery

Status: **storyboard + plano de teste prontos; teste NÃO executado** (exige API paga ou download de footage — ambos aguardam autorização). Nada pago foi chamado.

## 1. Diagnóstico do vídeo rejeitado (`final.mp4`, Benchmark 001)

Rejeição aceita. Causa raiz, não sintomas:

| Sintoma | Causa |
|---|---|
| Parece slideshow animado | 100% do quadro é desenhado em código (vetor + PNG 800 px). Não existe nenhum pixel de mundo físico: tecido, água, luz real. |
| Produto parado enquanto texto aparece | Packshot 2D só aceita translate/scale; sem plate de ambiente nem câmera 3D não há como dar volume. |
| Texto dominando | Sem imagem forte, a mensagem foi carregada pela tipografia (1,6 palavra/s na tela). |
| Sem demonstração | O "problema" e o "mecanismo" foram ilustrações; não há líquido, tecido nem lavagem. |
| Pipeline | O QC media formato, áudio e ritmo — nunca "existe imagem fotográfica?". Gate novo abaixo. |

Conclusão: o Remotion não é o problema; usá-lo como **fonte de imagem** é. Nesta missão ele fica restrito a tipografia, acabamento, montagem, composição e identidade.

## 2. Pesquisa técnica (2026-10-08)

| Item | Achado | Evidência |
|---|---|---|
| Veo 3.1 (fal) | US$ 0,20/s sem áudio, 0,40/s com áudio (720p/1080p); 4K 0,40/0,60. Endpoint reference-to-video aceita imagens de referência (até 3, segundo terceiros) | DOCUMENTED — [fal llms.txt](https://fal.ai/models/fal-ai/veo3.1/reference-to-video/llms.txt), [muapi](https://muapi.ai/playground/veo3.1-reference-to-video) |
| Kling 3.0 / O3 | 3.0 = i2v com 1 imagem; **O3 (Omni)** = reference-to-video com até 10 referências, voltado a controle | DOCUMENTED — [PixVerse](https://pixverse.ai/en/blog/kling-o3-and-3-0-now-available-on-pixverse), [RunComfy](https://www.runcomfy.com/de/models/kling/kling-3.0/standard/image-to-video) |
| Fidelidade de rótulo em vídeo IA | **Nenhuma fonte** garante texto de rótulo estável em i2v; benchmarks de texto apontam falhas. Prática de mercado: manter os pixels reais da embalagem e gerar o entorno | DOCUMENTED — [nightjar](https://nightjar.so/blog/best-ai-tools-for-packaging-heavy-product-photos) |
| ComfyUI local | Wan 2.2 i2v: ≥ 6–8 GB de VRAM NVIDIA com quantização, ~3 min por 5 s em 480p; LTX-2: 12 GB (FP8). Wan 2.2 Apache 2.0; LTX-2 com teto de receita | DOCUMENTED — [runflow](https://www.runflow.io/blog/comfyui-wan-2-2-image-to-video), [nemovideo](https://www.nemovideo.com/blog/ltx-2-3-vs-wan-2-2), [docs.comfy.org](https://docs.comfy.org/tutorials/video/ltx/ltx-2.md) |
| Esta máquina | Intel Graphics integrada, 7,7 GiB RAM, sem GPU NVIDIA | OBSERVED — **ComfyUI de vídeo local é inviável aqui**; só em GPU de nuvem |
| OpenMontage (lab) | Já integra Kling (fal/oficial), Veo (fal/Vertex, com first/last frame e referências), Seedance, Wan, LTX, Runway, MiniMax, Hunyuan, ComfyUI, Pexels/Pixabay, compositor Remotion, cost tracker e roteamento de provider | OBSERVED — `tools/video/*.py` |
| OpenMontage, custo | Estimativa interna do Kling: US$ 0,10–0,30 por 5 s — **abaixo** do preço publicado atual (Kling v3 Pro ≈ US$ 0,56 por 5 s) | OBSERVED + DOCUMENTED — divergência a corrigir antes de confiar no budget guard dele |

**Revisão da minha avaliação anterior:** no Benchmark 001 eu disse que o teto visual do OpenMontage sem chaves era o HTML do agente. Isso continua verdadeiro sem chaves, mas **com chaves ele tem o roteador de providers mais completo disponível aqui** — relevante para esta missão.

## 3. Princípio técnico que decide a arquitetura

A embalagem nunca é desenhada pelo modelo de vídeo por mais do que um movimento curto e verificado:

1. **Mundo físico (tecido, água, líquido, roupas, mãos) → vídeo gerado por IA ou footage licenciado.** Sem a embalagem no quadro, ou só a tampa.
2. **Packshot → plate gerado por IA (cenário vazio, luz, água) + pixels reais da embalagem compostos no Remotion** (sombra de contato, light wrap, reflexo, cáusticas, parallax). Fidelidade 100% por construção.
3. **Movimento 3D real da embalagem → i2v curto (≤ 4 s, órbita ≤ 10°) com primeira imagem = composição real**, seguido de **gate automático de fidelidade** (SSIM/OCR da região do rótulo contra o original). Take que deforma é descartado.

Pré-requisito que **falta hoje**: packshot em alta resolução. O PNG atual tem 800 px; num 1080×1920 premium a embalagem precisa de ≥ 2.000 px na altura. Upscale por IA pode alterar o texto do rótulo, então não é solução. Precisamos da foto original do estúdio ou de fotos novas (frente, ¾, tampa).

## 4. Comparação de pipelines

Notas 1–10, INFERRED (pesquisa + inspeção de código; nenhum render ainda). Pesos: qualidade comercial 30%, consistência/fidelidade 25%, automação 20%, controle 15%, custo 10%.

| Critério | A. OpenMontage + IA + Remotion | B. Claude Code + Kling/Veo + Remotion | C. ComfyUI + modelos + Remotion/FFmpeg | D. Híbrido proposto |
|---|---:|---:|---:|---:|
| Qualidade comercial | 8 | 8 | 7 (modelos abertos abaixo de Veo/Kling em física fina) | 8,5 |
| Consistência / fidelidade da embalagem | 6 (i2v direto se o agente não compuser) | 7 | 8 (ControlNet/máscaras, mas exige engenharia) | **9** (pixels reais + gate de fidelidade) |
| Automação | 8 (roteador, cost tracker, checkpoints) | 7 (precisamos escrever o cliente de provider) | 5 (workflows frágeis, GPU de nuvem) | 8 |
| Controle | 6 (AGPL, 2 patches, outro perfil de execução) | 8 | 9 | 9 |
| Custo por teste | 8 | 8 | 5 aqui (GPU de nuvem obrigatória) | 8 |
| Manutenção / licença | 5 (AGPLv3) | 8 | 5 | 7 |
| **Ponderado** | **7,0** | **7,7** | **6,9** | **8,6** |

### D — arquitetura híbrida recomendada
```
creative.v2 (storyboard por cena) ─► Asset Router
   ├─ cenas físicas sem embalagem  → Veo 3.1 / Kling 3 (t2v) ............ 2 providers por cena no teste, escolhe-se o melhor take
   ├─ plate do packshot (sem produto) → Veo 3.1 / Kling 3 (t2v)
   ├─ movimento curto da embalagem → Kling O3 ref2v ou Veo 3.1 first-frame, ≤ 4 s ─► GATE de fidelidade do rótulo
   └─ fallback barato             → stock licenciado (Pexels/Pixabay)
─► Remotion: composição do packshot real, grading único, tipografia mínima, CTA, legendas
─► FFmpeg ─► QC técnico (já existe) + QC visual novo ─► manifests (já existem)
```
- O cliente de provider pode ser **o do OpenMontage** (reaproveitar `kling_video.py`/`veo_video.py` como biblioteca, isolado por causa da AGPL) **ou** um cliente fino próprio (~150 linhas). Decisão depois do teste: se o roteador do OM economizar trabalho real sem forçar o pipeline dele inteiro, entra como provider layer. É a função "USE_AS_ORCHESTRATOR parcial" que faltava testar.
- ComfyUI fica para quando houver GPU de nuvem e uma necessidade que só ele resolve (ex.: controle de máscara fino); não é caminho crítico.

## 5. Gates novos de aceitação (§6 do pedido)

| Rejeitar se | Como medir |
|---|---|
| Imagem estática disfarçada | fluxo óptico médio por cena (FFmpeg `mestimate`/`vidstabdetect`) abaixo do limiar; e cena com origem `procedural` > 20% do tempo |
| Zoom repetitivo | detectar transformações só de escala em ≥ 2 cenas seguidas |
| Texto dominando | área de texto por frame (bounding boxes do Remotion) > 12% fora do CTA |
| Cenário artificial / IA óbvia | revisão humana obrigatória + rubrica do agente |
| Deformação da embalagem | SSIM ≥ 0,90 e OCR das palavras do rótulo (GRAND, SABÃO LÍQUIDO, PREMIUM, 5L) em todo frame com embalagem |
| Sem demonstração | ≥ 1 cena com `action` de uso real (despejar, diluir, lavar) |
| Slides / transições genéricas | transições só por corte de movimento, match cut ou corte seco; fades/wipes proibidos por padrão |

Arquivos: [concepts.md](concepts.md) · [storyboard.md](storyboard.md) · [test-plan.md](test-plan.md) · storyboard visual publicado como página.
