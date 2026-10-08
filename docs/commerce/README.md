# Dual Commerce — primeiro incremento funcional

Um módulo aditivo ao monólito. Contratos e funções puras em `src/commerce`; orquestração filesystem/render em `commerce/benchmark.ts`. A Foundation, compliance anterior e renderizadores existentes não foram alterados.

## Referências consolidadas consultadas

Verificadas via plugin GitHub e fontes oficiais em 2026-10-08. Adotamos padrões de desenho, não copiamos código nem instalamos serviços. Popularidade e casos comerciais não comprovam vendas deste projeto.

| Repositório | Aplicação concreta | Licença / decisão |
|---|---|---|
| [medusajs/medusa](https://github.com/medusajs/medusa) | Separação de produto, conta, listing e operação comercial; domínio desacoplado de providers. | Core MIT; materiais Enterprise têm licença comercial própria. Nenhuma dependência adicionada. |
| [saleor/saleor](https://github.com/saleor/saleor) | Escopo explícito de canal, mercado, moeda, preço e estoque em cada listing e atribuição. | Core BSD-3-Clause. Não importamos backend GraphQL/PostgreSQL. |
| [growthbook/growthbook](https://github.com/growthbook/growthbook) | Diferenciar geração de variantes de experimento controlado; sem dados, resultado `NOT_VALIDATED_BY_CONTROLLED_EXPERIMENT`. | MIT fora dos diretórios Enterprise. Serviço/SDK não instalado neste incremento. |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | Stack de vídeo já presente no projeto; reutilizamos seus tipos de timeline e o pipeline CPU/FFmpeg/QC. | Uso continua sujeito à licença vigente do Remotion; não contratar plano nem presumir licença irrestrita para futura escala empresarial. |

Padrões reutilizados não tornam criativos “validados”. Escala comercial exige produto/oferta elegíveis, publicação autorizada e experimento com métricas confiáveis. Não há promessa de vendas bilionárias.

## Contratos e isolamento

`contracts.ts` define Brand, Product, SellerAccount, AffiliateAccount, Shop, CommerceListing, AffiliateOffer, CommissionPlan, CreativeCampaign, CreativeVariant, ShoppableVideo, Publication, OrderAttribution e PerformanceEvent. Schemas estritos rejeitam campos inesperados; credenciais não fazem parte desses contratos. IDs não aceitam paths.

Cada operação valida marca, produto, conta, modalidade, shop, listing, mercado, canal, moeda, idioma e tipo de evidência. Seller não carrega offer/affiliate; affiliate não carrega receita/margem seller. Atribuição recusa mistura, pedidos duplicados e variantes desconhecidas. Snapshots cumulativos usam o mais recente por variante. Valores monetários são inteiros em unidade mínima da moeda; comissão em basis points, truncada para baixo usando BigInt. O arredondamento efetivo da plataforma pode divergir e deve ser reconciliado na futura integração.

Margem estimada só existe com preço e todos os custos fornecidos. A caller deve fornecer a lista completa (produto, taxas, frete, impostos etc.); este módulo não descobre custos. Sem observações, métricas ficam `null`; zero só é usado quando há observação explícita. O dashboard offline tem sete filtros e preserva cards/ledgers separados, sem soma entre moedas ou entre REAL_DATA e MOCK.

Ranking exclui ofertas sem autorização, elegibilidade, estoque/preço conhecidos ou com prazo vencido. Taxa de comissão, qualidade, reputação, adequação editorial, demonstrabilidade e risco compõem um score transparente; desconhecidos são expostos e não recebem pontuação inventada. Preço e comissão monetária estimada aparecem separadamente, sem comparar quantias de moedas diferentes como performance. O score é uma hipótese editorial, não um modelo validado de vendas.

## Governança e plataformas

Aprovação humana deve corresponder ao fingerprint dos inputs, variantes e política. Alteração de produto, oferta, categoria, QC ou política invalida a aprovação. Também são exigidos preço/estoque, permissão de promoção, elegibilidade da conta/listing/oferta, licença, política comercial, avaliação de disclosure de IA, limite conhecido e API autorizada. `MOCK` nunca concede publicação real.

O planejador aceita somente copy determinística extraída de claims aprovados no idioma pedido; referências desconhecidas ou copy modificada são recusadas. REAL_DATA é metadata interna e é rejeitada no conteúdo. Não há depoimento, experiência pessoal inventada ou inferência de eficácia a partir de stock.

A interface `CommercePlatformAdapter` implementa os nove métodos pedidos. `UnsupportedPlatformAdapter` retorna NOT_SUPPORTED em todos; não possui HTTP, SDK ou token. `MockCommerceAdapter` exige contexto inteiramente MOCK, simula um catálogo isolado e mantém `published: false`. Não existe upload, link shoppable ou endpoint inventado.

Para integração futura de TikTok Shop são necessárias aplicação/aprovação e autorizações oficiais separadas de seller e creator/affiliate, além de elegibilidade do produto/oferta e scopes correspondentes: [TikTok Shop Affiliate Integration](https://partner.tiktokshop.com/docv2/page/affiliate-integration). Publicação TikTok exige acesso aprovado, consentimento e escopo `video.publish`; clientes não auditados têm restrições: [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started/). Publicar vídeo por essa API não comprova acesso à anexação de produto do Shop.

Instagram, Facebook, YouTube Shorts, Shopee, Mercado Livre e Amazon têm identificadores de canal no contrato, mas nenhuma integração real neste incremento. PT-BR, EN-US e ES possuem hooks localizados; claims só podem ser usados se houver tradução aprovada na fonte. Outros idiomas ficam bloqueados até cadastro de templates/traduções. Não inferimos elegibilidade por idioma.

Três formatos executáveis: descoberta, funcionalidades e catálogo. Os dez formatos pedidos constituem o catálogo de evolução: tutorial, produto em uso, problema/solução, comparação, storytelling, demonstrativo e A/B mais amplo precisam de evidência/brief apropriado. Os pilotos usam montagem faceless com stock ilustrativo e packshot; não são prova de produto em uso nem experimento A/B já executado.

## Executar e verificar

```sh
pnpm run build
pnpm run validate:skills
pnpm test
node scripts/ci-smoke.mjs
node scripts/assert-fixture-eol.mjs
node --test ops/tests/ops.test.ts
node --test factories/static/tests/static.test.ts
pnpm run commerce:benchmark
git diff --check
```

Benchmark requer os assets privados GRAND já existentes, os arquivos stock verificados por hash da EDL, dependências existentes da Static Factory e ferramentas FFmpeg/ffprobe/Chrome existentes. Não baixa ferramenta, fonte ou footage. Linux pode configurar `MOS_FFMPEG`, `MOS_FFPROBE` e `MOS_CHROME`; o benchmark privado não roda no CI público. Os novos testes de domínio entram automaticamente nos gates atuais de build/test, inclusive matriz de PR.

Saída em `.mos/commerce`: dois diretórios separados, cada um com registro, brief, três roteiros, storyboard, MP4 1080×1920/30fps/18s, PNG estático, contato visual, QC, pacote TikTok Shop, compliance e relatório de performance/execução. `dashboard.html` reúne cards filtráveis. Todos os assets renderizados ficam ignorados e fora do Git; resumos/hashes sem mídia privada podem ser versionados.

GRAND usa cadastro real previamente aprovado; preço, estoque, Shop, licença pública do packshot e autorização permanecem não verificados. Affiliate usa produto/arte/valor/comissão fictícios identificados como MOCK. Ambos geram arquivos reais; ambos têm pacote de publicação BLOCKED e anexação shoppable NOT_SUPPORTED. Nenhum mock financeiro é apresentado como venda real.

Cloud-first usa o control plane existente: não despachar render remoto com assets privados para o repositório público, com billing bloqueado ou sem verificação de gratuidade. Este benchmark utiliza fallback explícito CPU local, dois threads, sem GPU ou APIs pagas, porque o objetivo exige arquivos renderizados. Isso não elimina consumo de CPU/energia; gasto contratado/API adicional é zero. Cache/retention permanecem sob regras existentes de `.mos`; nenhum cleanup externo ou remoção de arquivos do usuário é executado.

Stock existente é reutilizado por hash. A [licença Pexels](https://www.pexels.com/license/) foi lida em 2026-10-08 e permite uso modificado em marketing, vedando endosso implícito. A nota histórica de leitura bloqueada na EDL anterior foi preservada; o novo pacote registra a verificação atual separadamente. Revisão de rostos, marcas, licenças, categoria saneante e publicação continua humana. QC técnico não equivale a aprovação comercial.

Próximo incremento depende de review independente, permissões oficiais e dados reais: conectar adapter aprovado; acrescentar métricas auditáveis e desenho de experimento; só então selecionar criativos por resultado observado. Não contratar serviços, copiar materiais Enterprise ou ampliar a produção para conseguir escala aparente.
