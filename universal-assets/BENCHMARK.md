# GRAND: três estratégias, três estudos de seis segundos

O anúncio rejeitado permanece intacto: `.mos/commerce/grand-commerce-pilot-a5942ee92319/ugc-faceless.mp4`, SHA-256 `adb52f95c55cc86ceb819e328d956c7abffd548d8055569007ea0b6d825c6f27`. A [auditoria anterior](../creative-quality/AUDIT.md) documenta a moldura com footage pequeno, abertura genérica, pouca demonstração e identidade de template. Agora há fotografia em tela inteira e reconhecimento do frasco já na abertura; isso é melhoria concreta de composição, sem comprovar retenção ou vendas.

| Estratégia / conceito | Público, problema, argumento e CTA | Sequência realizável / fontes | Avaliação editorial e limites |
|---|---|---|---|
| A Stock-first: matéria em movimento | Compradores de sabão líquido; o produto precisa ser identificado sem ficar preso a uma moldura. Nome e volume aprovados; CTA Conheça a GRAND. | 0–2s textura têxtil + frasco; 2–4s água e nome; 4–6s tecido + frasco/CTA. Pexels ArtHouse Studio e dumitru bumbu; fotografia original. | Footage real, composição claramente ilustrativa. Identidade aparece cedo; frasco sobre tecido é colagem, não filmagem física. Não é resultado da lavagem, nem benefício comprovado. Ganho de ocupação visual; relação entre frasco e ambiente ainda requer direção humana. |
| B AI-first: a marca no cotidiano | Compradores que reconhecem um ambiente doméstico organizado; aproximação visual sem filmagem de cada SKU. Benefício visual é contextualização, não alegação de desempenho. Nome/5 L/CTA aprovados. | 0–2s ambiente de IA e frasco; 2–4s nome; 4–6s CTA. Cenário criado nesta sessão; frasco original preservado, movimento 2D de edição. | Ambiente mais coerente que gráficos genéricos. Perspectiva e iluminação do packshot não foram recriadas; azul e reflexos podem parecer recorte sobre cenário. Não é vídeo generativo nem local real. Som não é sincronizado; narrativa ainda curta para persuasão. |
| C Hybrid: azul e luz | Mesmo mercado, com associação editorial entre textura e identidade; sem alegar tecido lavado pela GRAND. Nome/volume/CTA aprovados. | 0–2s díptico com footage têxtil em movimento, cenário IA e frasco; 2–4s textura em tela inteira; 4–6s díptico e CTA. Pexels + cenário IA + foto real. | Direção de colagem editorial distinta do ambiente único B. Combina materiais existentes sem modelo de vídeo. Corte entre textura e cena não comprova uso. Necessita avaliação de continuidade, contraste e encaixe do frasco antes de virar anúncio. |

Todos: 1080×1920, 30fps, 180 frames, H.264 yuv420p, AAC estéreo 48 kHz. Três MP4 reais e storyboard visual, não simulações de um render. Os hashes e tempos finais estão em [EVIDENCE.json](EVIDENCE.json). Foley de água [CC0 de jcpmcdonald](https://opengameart.org/content/skippy-fish-water-sound-collection), sem depoimento ou narração fabricada. Archivo OFL 1.1.

O benchmark compara rotas de aquisição/composição, não uma competição de modelos generativos. A usa material previamente licenciado; B e C usam uma nova imagem de IA. Não existe footage de resultado real da GRAND aqui. A anotação cinematográfica e os scores de triagem são avaliação editorial deste estudo, não métricas de consumidor, validação por vendas ou certificado de qualidade profissional.

## Recursos e custo

Uma imagem gerada pelo recurso integrado do Codex; nenhuma compra, chave de API de geração, GPU contratada ou peso baixado. Render FFmpeg limitado a dois threads, execução sequencial, reutilização do Chrome/fonte/stock já instalados. Não é cloud render: a geração de imagem ocorreu no serviço integrado, a composição final leve ocorreu nesta máquina. Quota restante e custo interno da assinatura não são visíveis, e não os tratamos como ilimitados ou zero absoluto.

A cada amostra, medir tempo real de render, hashes, resolução, frames, codec, áudio, blackdetect, loudness e pico. Não substituir ausência de recursos por chamadas pagas. Wan/LTX/Spaces são candidatos documentados, não providers executados. As APIs de stock não foram chamadas ao vivo porque as chaves estão ausentes.

## Gates e evolução sem despesas adicionais

TECHNICAL_QC passa somente com as medições. CREATIVE_QC, BRAND_QC e HUMAN_APPROVAL permanecem PENDING; COMMERCE_QC BLOCKED sem oferta/direitos de publicação verificados. Escala SUSPENDED. A proposta deve ser revista visualmente no board; não declarar padrão de agência somente por testes ou QC técnico.

Próxima evolução autorizável: escolher a direção após revisão; ajustar posição, escala e sombra da fotografia existente, compor cenários adicionais pela assinatura disponível quando houver quota, e catalogar uma seleção pequena de assets com proveniência. Novas fotos voluntárias ou material oficial do fabricante podem melhorar o packshot, mas não são requisito para cada produto. Uma demonstração real permanece opcional para anúncios de identidade e indispensável apenas quando se pretende alegar uma demonstração/resultado real. Nada disso autoriza produção em massa ou compra de serviço.
