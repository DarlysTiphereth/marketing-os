# Creative Quality Recovery — estudos, não aprovação comercial

2026-10-08. **Expansão de produção suspensa até aprovação criativa explícita.** Nenhum anúncio completo ou lote novo é produzido nesta rodada. Os pilotos anteriores estão rejeitados pelo usuário; seus PASS técnicos não são aprovação publicitária.

Incremento isolado em `codex/creative-quality-recovery`, a partir de `011fcd3` / `feature/cloud-first-static-factory`. Seller/Affiliate e suas correções continuam no PR #1, intocados. Nenhum commit daquele PR é incorporado neste diff. As fábricas e contratos legados são preservados; o novo módulo é aditivo e pode coexistir depois da integração dos dois PRs.

## Entregáveis

- [Auditoria concreta](AUDIT.md): quatro renders anteriores, com primeiro frame, 0,5s, 1s e planos posteriores.
- [Pesquisa profissional](REFERENCES.md): fontes primárias, observações visuais e limites da pesquisa.
- [Três conceitos originais](concepts.json): público, problema, benefício/fonte/escopo da prova, ideia, diferencial, hook, argumento, linguagem, sequência e CTA.
- [Comparação de pipelines e evolução sem contratação](PIPELINES.md).
- [Evidência de execução](EVIDENCE.json): hashes, tempos e gates separados. Não é certificado de qualidade criativa.
- Board privado `.mos/creative-recovery/review.html`: dois players lado a lado, storyboard visual com frames reais, abertura/primeiro segundo e campos para críticas. As imagens/MP4 continuam fora do Git público.
- Amostra A: `.mos/creative-recovery/a-sample.mp4`, 7s, beauty shot de produto composto sobre água real, insert de tecido e CTA aprovado.
- Amostra B: `.mos/creative-recovery/b-sample.mp4`, 7s, lavagem manual faceless em luz natural. **É estudo demonstrativo da categoria, não uso/eficácia da GRAND nem depoimento.**

Os melhores conceitos executáveis foram escolhidos por adequação aos assets, não por suposta previsão de vendas: **O azul tem nome** e **Entre as mãos**. **Da matéria ao nome** permanece bloqueado por macro autêntico em resolução suficiente. Não produzir uma terceira amostra.

## Camada de direção

`src/creative-quality/director.ts` é puro: valida conceitos, recusa hooks genéricos, narrativa inconsistente, assets ausentes/sem hash/direitos desconhecidos e prova de produto baseada em ação de categoria. Não possui acesso a filesystem, providers ou filas. Conceitos são desenvolvidos editorialmente antes do render; este módulo controla sua admissibilidade, não finge substituir um diretor ou prever retenção.

`render-studies.mjs` resolve os arquivos reais, verifica hashes contra o cadastro/EDL e as fontes, exige benefício com copy já aprovada e executa somente duas amostras de 5–8s. Não substitui cenas ausentes por ícones, desenhos, TTS ou slides. Imagens/gráficos decorativos não são apresentados como prova de produto em uso. Remotion não gera o mundo físico: seu pipeline/utilitários existentes são reutilizados para IO e processamento; Chrome compõe fotografia/texto e FFmpeg corta/compõe/codifica.

`review-board.mjs` extrai frames dos MP4 efetivos, registra tempos/hashes e compara o mesmo instante (0,5s) nos quatro vídeos principais. Não usa a imagem nova como substituto de um benchmark ausente. Verifica que os MP4 ainda correspondem aos hashes do relatório antes de apresentá-los. A grade inclui também o benchmark cinematográfico e o antigo render GRAND com desenhos. Frames JPEG são decodificados no Chrome para prévias PNG consistentes.

## Gates independentes

| Gate | Nesta rodada | Significado |
|---|---|---|
| TECHNICAL_QC | PASS nas duas amostras | Duração, frames, codec, resolução, áudio, black frames, loudness/peak e layout medidos. |
| CREATIVE_QC | PENDING | Agência, narrativa, realismo, desejo e retenção exigem crítica visual humana; não são inferidos do codec. |
| BRAND_QC | PENDING | Paleta derivada de asset, sem brand book; direitos públicos da embalagem não confirmados. |
| COMMERCE_QC | BLOCKED | Sem oferta/permissão verificada nem prova de uso/eficácia da GRAND. B não é peça comercial de produto. |
| HUMAN_APPROVAL | PENDING | Usuário ainda não aprovou A/B. |

`scaleDecision` exige todos os gates PASS e revisão nominal/datada vinculada ao fingerprint exato de conceito, assets e vídeo; qualquer mudança invalida a decisão anterior. Os programas desta entrega não aceitam comandos de escala/publicação e não convertem notas da página em aprovação automática. A Foundation de fixtures permanece disponível; nenhuma expansão de produção comercial está autorizada. Não há integração oculta com a fila/engines comerciais existentes.

## Asset-first e limitações materiais

Disponível: packshot autêntico 800×800 (objeto útil 262×690), label/logo locais, footage Pexels de água/tecido/mãos verificado por hash, Archivo OFL e Foley CC0 de água. A usa pixels reais da embalagem sem upscale generativo, em até 800px de canvas. Não há órbita 3D real, relighting da embalagem ou rótulo inventado.

Ausente: packshot de estúdio em alta resolução, frente/3/4/tampa, cenário fotografado com o frasco, dosagem/uso GRAND, demonstração com método e resultado verificáveis, VO humana própria, som direto dos takes e brand book. Nenhum desses itens foi tratado como disponível. A água é cenário ilustrativo; não é detergente ou evidência de diluição. Áudio CC0 é Foley de pós-produção, não som síncrono captado da pessoa filmada. Há uma trilha original esparsa, sem música comercial importada. Efeitos limitados a composição/sombra/texto, sem simular química ou eficácia.

A melhora observável é de hierarquia, área fotográfica e montagem. A embalagem composta ainda pode parecer recortada/flutuante; B tem fundo e ação de stock que não foram dirigidos para a GRAND. **Padrão de agência ainda não demonstrado/aprovado.** Não atribuir nota alta nem declarar o problema resolvido com base nos testes.

## Reprodução sem instalação

Node 24 usado no teste; TypeScript/Zod/Chrome/FFmpeg e Fontsource já existentes. Nenhuma dependência/lockfile ou infraestrutura adicionada. Configurar `MOS_FFMPEG`, `MOS_FFPROBE`, `MOS_CHROME` se as ferramentas portáteis estiverem em outros locais. Os caminhos dos assets seguem o cadastro e a EDL existentes. Arquivos privados são pré-requisitos locais; o repositório público sozinho não contém material para render.

Baixar manualmente apenas o `swim.wav` CC0 já verificado, se ausente, de [Skippy Fish Water Sound Collection](https://opengameart.org/content/skippy-fish-water-sound-collection), para `.mos/creative-recovery/assets/swim.wav`. SHA256: `9a968e9083ca7979b225838c218e59d9f4da7fa5ddbd20567cd4b45a3c8814f8`. Autor jcpmcdonald; o render não faz downloads nem chama providers. Arquivos de referência de concorrentes não entram em cenas.

```sh
pnpm run build
pnpm test
node --experimental-strip-types creative-quality/render-studies.mjs
node --experimental-strip-types creative-quality/review-board.mjs
```

Este branch testa os 63 testes da Foundation mais oito regressões criativas; os 38 testes commerce permanecem no PR #1. Contagens de branches distintos não são somadas como se rodassem juntas. Aprovação de código e CI também não autorizam qualidade criativa ou publicação.
