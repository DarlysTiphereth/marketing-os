# Dual Commerce — auditoria do ponto de partida

Auditado em 2026-10-08. Base: `011fcd3`, branch anterior `feature/cloud-first-static-factory`, working tree originalmente limpo. Incremento isolado em `codex/tiktok-shop-dual-commerce`. Esta expansão foi expressamente solicitada pelo usuário; a Foundation e seus contratos continuam intactos. Não é uma migração de plataforma.

| Componente | Estado inicial | Evidência executável e limite |
|---|---|---|
| Product Database | PARTIAL | `factories/shared/products/grand/sabao-liquido-premium-5l.json`, loader e hashes. Catálogo em arquivo; preço/estoque UNKNOWN; sem banco ou Shop real. |
| Brand Intelligence | PARTIAL | Brand kit GRAND e fontes aprovadas. Kit derivado do rótulo; manual oficial e aprendizado automático ausentes. |
| Creative Intelligence | PARTIAL | Templates, briefings, benchmarks e estratégia determinística; nenhum criativo validado por vendas observadas. |
| Video Factory | IMPLEMENTED | Remotion/FFmpeg CPU, produção de timelines, áudio e vídeos locais. Implementação limitada à produção local; não constitui integração comercial. |
| Static Creative Factory | IMPLEMENTED | Renderização Chrome, templates, medição de layout e testes em `factories/static`. Assets privados permanecem locais. |
| Faceless Factory | PARTIAL | Templates sem apresentador, footage de mãos/roupas; revisão visual humana ainda necessária. Não há detector universal de rostos. |
| Variant Engine | IMPLEMENTED | Expansão determinística Foundation e seleção de diversidade estática, com testes; sem validação de performance. |
| Render Pipeline | PARTIAL | Planejamento, áudio, render CPU, QC, CAS/cache/retention executáveis. Workers cloud existem, mas disponibilidade depende de permissões/cotas; não presumir billing desbloqueado. |
| Quality Control | PARTIAL | Schemas, evidência de claims, hashes, resolução/fps/áudio/layout medidos. Não substitui aprovação regulatória, jurídica ou editorial. |
| Experiment Engine | PARTIAL | Configurações de benchmarks e variantes. Sem experimento controlado nem vendas reais. |
| GitHub CI/CD | BLOCKED | Workflow versionado e gates locais executáveis. Run `37559175186`, tentativa 4, conferida via API em 2026-10-08: quatro jobs com steps vazios, runner vazio e anotação “The job was not started because your account is locked due to a billing issue.” Nova execução deve ser inspecionada antes de declarar CI funcional. |
| Seller/Affiliate domain | MISSING | Não havia contratos de contas, ofertas, comissões ou atribuição comercial isolada. |

O incremento adiciona domínio e simulação de commerce, reaproveitando produção e QA. Não instala stack de ecommerce, SDK pago, banco, fila ou serviço. As funcionalidades reais de TikTok Shop permanecem `NOT_SUPPORTED` até comprovação de acesso oficial.
