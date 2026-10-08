# Comparação de pipelines e evolução com gasto contratado adicional zero

Não é ranking numérico de promessas. A/B/C não executaram uma mesma cena sob condições equivalentes nesta rodada; D não foi executado. Separar medição, observação histórica e documentação.

| Opção | Qualidade/controle | Limite concreto | Custo adicional e velocidade |
|---|---|---|---|
| A. OpenMontage gratuito | Orquestra pesquisa/planos/stock/edição; pode usar footage real sem gerador pago. Não cria prova nem fotografia de produto ausentes. | Benchmark local histórico: 15s, HyperFrames/product reveal, review criativo ainda não aprovado. Nenhuma nova integração ou provider neste branch. | Software/provider são coisas distintas. Zero API no benchmark histórico; tempo comparável desta rodada UNKNOWN. Exemplos upstream com Veo/Kling pagos não representam caminho gratuito. |
| B. Remotion + FFmpeg + footage | Edição/composição controlável, identidade consistente; o arquivo cinematográfico anterior prova render de motion stock. | Remotion não é câmera nem gerador de material; sem direção de shots ele monta um catálogo. Fonte/VO/prova e direitos continuam requisitos. | Histórico 23,5s: manifest mede 226,3s, CPU; não é comparação normalizada com 7s. Uso depende dos termos vigentes do Remotion. |
| C. Imagens reais + assets licenciados | Escolhido: fotografia autêntica + motion stock em quadro inteiro, composição/tipografia Chrome e montagem FFmpeg; rótulo sem geração. | A limitada por packshot 800×800 e ausência de plate real com frasco. B é categoria sem GRAND em uso. Não garante qualidade de agência. | Dois estudos de 7s; tempos medidos em EVIDENCE.json. CPU existente, 2 threads, sem GPU/API/contratação; energia não medida como custo contratado. |
| D. Generativos gratuitos | Wan/LTX podem gerar imagem em movimento, mas textura, física e rótulo precisam de controle/revisão. | Máquina observada: ~7,7GiB RAM, Intel Graphics integrada, sem CUDA. Nenhuma GPU de nuvem disponível/gratuita foi verificada. | Não executado; custo/velocidade deste hardware UNKNOWN. Zero chamadas. Não presumir Kling/Veo grátis ou quotas de GPU ilimitadas. |

[OpenMontage upstream](https://github.com/calesthio/OpenMontage) declara caminhos de stock/FFmpeg e fornecedores opcionais. Core AGPLv3; não copiar/linkar código neste incremento. O repositório analisado é calesthio/OpenMontage, não um downloader homônimo com licença distinta. O runtime local histórico segue commit `9327439`; não foi atualizado, nem executado novamente para gerar um terceiro anúncio.

[Wan 2.1 1.3B, fonte do modelo](https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B) documenta ~8,19GB VRAM e exemplo de cinco segundos/480p em ~quatro minutos numa RTX4090. Essa medição do fornecedor não se aplica à Intel integrada. [LTX-Video upstream](https://github.com/Lightricks/LTX-Video) documenta variantes menores/quantizadas; não confundimos memória de LoRA com memória do modelo inteiro. Nenhum modelo/peso instalado. Licenças/condições da versão concreta e acesso a GPU precisam ser verificados antes de qualquer futuro experimento.

## Decisão

Reutilizar C como laboratório de **duas amostras**, com as ferramentas de B que já existem. OpenMontage é referência de processo, não solução automática para o déficit de assets. Não abrir pipeline de geração paga nem render remoto enquanto gratuidade, direitos e hardware forem desconhecidos. Billing GitHub anteriormente bloqueado não será “resolvido” alterando a criação; CI de código é independente de aprovação criativa.

## Evolução sem despesas adicionais

1. **Agora:** usuário rejeita/ajusta/aprova A e B pela imagem e áudio. Não produzir anúncio completo, mais variantes ou lote. Manter fingerprints da versão julgada.
2. **Captação com meios existentes:** usar telefone já disponível, janela com luz lateral difusa, superfície neutra real, exposição/white balance travados; captar frente/3/4/tampa/label e frasco no ambiente. Sem pressupor compra de equipamentos. Priorizar foto original em alta resolução, não upscale generativo.
3. **Prova específica:** filmar GRAND de fato sendo usado com orientação validada, mantendo gesto contínuo e condições comparáveis. Não criar antes/depois com peças diferentes, nem alterar manchas digitalmente. Guardar origem e aprovação; se faltar prova, limitar copy ao que a fonte suporta.
4. **Som e presença:** captar áudio ambiente/gesto com telefone existente e narração humana consentida; testar inteligibilidade, sem falso testemunho. Verificar disponibilidade antes de tornar voz essencial ao conceito.
5. **Só após aprovação dos estudos e disponibilidade material:** transformar o conceito escolhido em um anúncio, revisar cinco gates; escalar somente com aprovação criativa explícita e requisitos comerciais satisfeitos. Depois, experimento de vendas autorizado com métricas reais, sem inferir performance a partir do render.

Não há cron, publicação automática, contratação, novo servidor, frontend comercial ou mudança nos contratos/engines do PR #1. O board é apenas um arquivo HTML privado para avaliar a prova visual.
