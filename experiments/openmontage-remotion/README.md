# Stack B — OpenMontage (direção) + Remotion (render)

**Status: NOT_RUN.**

Arquitetura alvo: OpenMontage produz research/script/scene_plan/asset manifest; um adapter converte para `creative.v1`; o renderer Remotion deste repositório (`experiments/remotion`) renderiza.

Observação relevante (OBSERVED no lab): o composer isolado do OM declarou Remotion **indisponível** e o renderer nativo do Remotion é bloqueado pelo Windows Application Control nesta máquina. Esta rodada **resolveu o segundo ponto** (Remotion `renderFrames` + FFmpeg externo), o que torna o Stack B tecnicamente viável.

Hipótese a testar: o valor do OM está em **processo** (checkpoints, schemas, revisão persistida, registry de providers), não em pixels. Se o adapter OM→creative.v1 for barato, B ≈ C em qualidade visual e > C em governança; se não, C + um planner próprio substitui o OM.

Pré-requisito: Stack A reexecutado com o conceito atual (para isolar o efeito do renderer).
