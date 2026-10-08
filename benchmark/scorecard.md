# Scorecard — Benchmark 001

Notas 1–10. Rótulos: **M** = MEASURED · **O** = OBSERVED · **I** = INFERRED (julgamento do agente) · **NT** = NOT_TESTED.

> ⚠️ Comparação **parcial**. Só a coluna *Remotion* foi executada sobre o conceito DR de ~37 s. *OpenMontage* usa evidência do Benchmark 002 do media-stack-lab (15 s, outro briefing — não controlada). *OM+Remotion* não rodou. *Hybrid* = núcleo Remotion executado + asset router com IA **não testado** (sem chaves/aprovação). Não leia esta tabela como vitória definitiva de nenhuma stack.

| Critério | OpenMontage (B002 lab) | OM+Remotion | Remotion-first (este repo) | Hybrid |
|---|---:|---:|---:|---:|
| Hook | 6 I (macro do galão + “GRAND.”, 15 s) | NT | 6.5 I (pergunta-problema, texto no frame 0, 1ª fala 0,03 s M, hook 2,27 s M) | NT |
| Visual | 6 I (40/50 do agente da época) | NT | 7 I (produto real, 8 cenas, 2 estilos; ilustrações vetoriais “clip-art”) | NT |
| Motion | 6 I (GSAP autoral; motion checker desligado) | NT | 7 I (springs, transições, shake, gloss; avaliado por stills) | NT |
| Storytelling | 5 I (reveal de produto, sem estrutura DR) | NT | 7.5 I (hook→problema→tensão→mecanismo→como usar→benefícios→payoff→CTA) | NT |
| Ad quality | 5 I | NT | 6.5 I (não aprovado: OVERALL < 8) | NT |
| Faceless quality | NT | NT | NT (Teste B não executado) | NT |
| Control | 6 O (contratos OM, HTML/GSAP; 2 patches) | NT | 9 O (tudo em código/JSON; claims validados; timing derivado da fala) | 9 I |
| Automation | 5 O (alto trabalho de autoria do agente por vídeo) | NT | 8 O (1 comando → MP4 + 6 manifests + QC; autoria do template ainda manual/agente) | 8 I |
| Reproducibility | 9 M (2 renders binariamente idênticos) | NT | 8 O (seeds, hashes de assets/código, versões; identidade binária **não testada**) | 7 I (IA não determinística) |
| API friendliness | 6 I (CLI Python + agente) | NT | 8 I (CLI/JSON; porta `RendererPort` proposta) | 8 I |
| Batch potential | 4 I (pipelines de vídeo único; batch NOT NATIVE — doc OM) | NT | 9 O (192 variantes endereçáveis; 5 renders; cache TTS 6–8/8 hits) | 9 I |
| Cost | 9 M (US$ 0 API) | NT | 10 M (US$ 0 API; ~3 min de laptop/vídeo) | 6 I (≈ US$ 0,36–1,18/vídeo projetado) |
| Speed | 6 M (CLI 71–79 s para 15 s) | NT | 7 M (176–212 s para 36–42 s ≈ 4,8 s de parede por s de vídeo) | NT |
| Maintenance | 4 O (venv+Node+browser, 2 patches, AGPL) | NT | 7 O (≈1.000 linhas próprias; Remotion pinado; contorno do compositor bloqueado) | 6 I |
| **Overall** | **5.5 I** | **NT** | **7.5 I** | **NT** |

## Runs executados (todos MEASURED)

| Run | Seleção | Dur. | Tech QC | Tempo | Nota |
|---|---|---:|---|---:|---|
| `…00-28-08…_v-8b8c2caff51d` | hook-a / body-1 / cta-a, standard | 41,8 s | **FAIL** (yuvj420p; true peak +0,6 dBTP) | 171 s | gates pegaram 2 defeitos reais → corrigidos |
| `…00-31-25…_v-8b8c2caff51d` | idem | 41,8 s | PASS (WARN cena 8 s) | ~170 s | base do review criativo (6.5) |
| `…00-35-12…_v-6742f3608018` | idem, **fast** (ciclo 1: pacing) | 37,4 s | PASS | 212 s | cena máx 7,17 s |
| `…00-38-48…_v-a9f595880b18` | hook-b / body-1 / cta-b, fast | 37,0 s | PASS | 175 s | 6/8 falas do cache |
| `…00-41-47…_v-8c67273c8d50` | hook-c / body-2 / cta-a, clean-bright, daniel | 22,3 s | **FAIL** duração (gate 30–46 s) | 122 s | body-2 é formato curto; **visual QC FAIL** (contraste no estilo claro) |
| `…00-44-08…_v-31bf548c4d26` | hook-a2 / body-1 / cta-a, fast (ciclo 2: hook) | 36,4 s | PASS | 176 s | hook 3,27 → 2,27 s |
| **`…00-47-22…_v-31bf548c4d26`** ⭐ hero final | hook-a2 / body-1 / cta-a, fast, deep-blue, maria, karaoke | 36,4 s | PASS (0 WARN) | 172 s | fixes de contraste/overlap/legendas; 8/8 TTS do cache; `code_fingerprint` no manifest |
| `…00-50-18…_v-26caa56e608d` | hook-c / body-1 / cta-b, **clean-bright**, **daniel**, fast | 35,5 s | PASS | 170 s | visual QC do estilo claro corrigido (texto navy, CTA branco) |

Nota: o run do ciclo 2 e o hero final têm o mesmo `variant_id` (mesma identidade criativa); diferem no código do renderer — por isso o manifest passou a registrar `code_fingerprint` (hash dos fontes). O run do ciclo 2 usou o código anterior aos fixes visuais (INFERRED por timestamps: bundle concluído ~16 s antes da edição).

Defeito residual conhecido (OBSERVED): legendas às vezes juntam palavras de duas frases da mesma cena ("sai Cheiro que") porque os cues de palavra do OneCore não trazem pontuação.

## Creative QC — hero (INFERRED, agente, 0–10)

| | Hook | Clarity | Pacing | Curiosity | Visual var. | Benefit | Credibility | Emotion | CTA | **Overall** |
|---|---|---|---|---|---|---|---|---|---|---|
| base (41,8 s) | 6.5 | 8 | 6.5 | 6 | 7 | 8 | 5.5 | 5 | 7.5 | **6.5** |
| ciclo 1 (pacing fast) | 6.5 | 8 | 7 | 6 | 7 | 8 | 5.5 | 5 | 7.5 | **6.7** |
| ciclo 2 (hook 2,3 s) + fixes visuais | 7 | 8 | 7.5 | 6.5 | 7 | 8 | 5.5 | 5 | 7.5 | **7.0** |

**Veredito: NÃO aprovado automaticamente** (OVERALL < 8 após os 2 ciclos permitidos). Ponto mais fraco remanescente: **credibilidade/emoção**, causadas por (1) voz sintética 16 kHz, (2) ausência de qualquer prova real (nenhum review/teste fornecido — corretamente não inventado), (3) problema mostrado com ilustração vetorial em vez de imagem real. Nenhum dos três é corrigível sem insumo novo (voz premium, prova verdadeira, footage real/IA) → requer decisão humana/aprovação de custo.
