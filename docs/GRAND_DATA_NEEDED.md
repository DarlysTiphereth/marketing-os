# Dados necessários para substituir a fixture GRAND

Não preencher lacunas com inferência. Uma coleta real deve identificar o responsável que confirmou cada dado e preservar os arquivos originais para hash e rastreabilidade.

1. Identidade: product_id/SKU, nome oficial, categoria, variante, volume/unidade, versão e vínculo com a marca.
2. Descrição oficial e evidência de origem: rótulo, ficha técnica, documento/site oficial ou informação formalmente confirmada. Incluir source_type, localização, cópia datada e hash.
3. Características e benefícios confirmados, cada um vinculado a source_ids; limites e condições de uso das afirmações. Nenhum benefício comercial ou de eficácia inferido.
4. Instruções completas de uso, diluição, superfícies/compatibilidades, limitações, armazenamento e descarte, conforme documentos oficiais aplicáveis.
5. Advertências, riscos, contraindicações, informação regulatória aplicável e claims expressamente proibidos; validação por responsável competente quando necessária.
6. Assets existentes: fotos/embalagem/logotipo/templates, IDs, arquivos/localização, hash, versão, titularidade/licença/permite uso e confirmação faceless. O template sintético não substitui mídia real.
7. BrandContext confirmado: versão, tom de voz, regras visuais e de conteúdo, padrões proibidos, locale/mercado e compliance_profile. O nome conhecido da marca não confirma esses defaults.
8. Objetivo, plataforma/formato, mercado, audiência/problema e CTA autorizados para a estratégia real. Dados ausentes ficam UNKNOWN ou exigem REVIEW.
9. BudgetPolicy comercial: moeda, período, scopes aplicáveis, soft/hard limits, premium_allowed e responsável por aprovar gastos. Preços de providers só quando adapters forem autorizados, sempre com versão e fonte.

Ao migrar, remover os marcadores de fixture apenas após confirmar todas as fontes; dados incompletos permanecem INCOMPLETE e não podem passar como produto verificado. Gerar um novo batch com nova chave idempotente para a nova versão. Real product/provider integration belongs to the authorized next phase after review.
