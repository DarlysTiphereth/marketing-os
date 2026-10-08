# Teste controlado — 7 s · planos 1 + 7 ("Gota" → "Herói")

## Por que estes planos
São os dois maiores riscos do filme e o momento-assinatura dele:
- **Plano 1** testa física realista (líquido viscoso entrando em fibras, câmera lenta macro). Se a IA não convencer aqui, o conceito não se sustenta.
- **Plano 7** testa fidelidade da embalagem com luz premium (plate gerado + pixels reais compostos) e, opcionalmente, se um i2v curto consegue mover o galão sem deformar o rótulo.
- O corte entre eles (mancha azul → set escuro do herói) é a rima visual do filme.

## Execução
| Passo | Provider / modelo | Qtde | Custo unit. | Máx. |
|---|---|---:|---:|---:|
| Plano 1, t2v 1080p | Veo 3.1 (fal), 4 s | 2 takes | US$ 0,80 | US$ 1,60 |
| Plano 1, t2v | Kling v3 Pro, 5 s | 2 takes | US$ 0,56 | US$ 1,12 |
| Plano 7, plate sem produto | Veo 3.1 (fal), 4 s | 2 takes | US$ 0,80 | US$ 1,60 |
| Plano 7, plate sem produto | Kling v3 Pro, 5 s | 2 takes | US$ 0,56 | US$ 1,12 |
| Plano 7, i2v da composição real (teste de fidelidade) | Veo 3.1 first-frame 4 s + Kling 3 i2v 5 s | 1 + 1 | 0,80 + 0,56 | US$ 1,36 |
| **Total máximo** | | **9 gerações** | | **≈ US$ 6,80** (teto pedido: **US$ 10**) |

Preços: fal (Veo 3.1, página oficial) e terceiros (Kling); confirmar no painel antes de rodar. Sem áudio gerado (som feito na pós).

Depois das gerações (local, US$ 0): escolher o melhor take por plano com o QC, compor o galão real sobre o plate no Remotion, grading único, sound design, encode, QC técnico + gates novos (movimento, fidelidade do rótulo por SSIM/OCR, área de texto).

## O que preciso para rodar
1. **Autorização do orçamento** (teto US$ 10).
2. **Chave do fal.ai** no arquivo `C:\Marketing-OS\.env` como `FAL_KEY=...`. Você cria a conta e a chave; eu não crio contas nem digito credenciais. A chave nunca vai para log, manifest ou Git (`.env` já está no `.gitignore`).
3. Packshot em alta resolução, se existir. Sem ele o teste roda com o PNG de 800 px e o plano 7 terá limite de nitidez já conhecido.

## Alternativa sem custo (parcial)
Footage gratuito licenciado (Pexels/Pixabay) para tambor e varal permite testar montagem, grading e som, mas **não** testa os planos 1 e 7, que são o risco real. Também exige sua autorização para baixar os arquivos.

## Comparação com o vídeo anterior (a fazer com o teste pronto)
Mesmo QC técnico + frames lado a lado nos mesmos instantes + as métricas novas: fração de pixels de origem fotográfica/gerada vs. desenhada, movimento óptico médio, área de texto, fidelidade do rótulo. O ganho visual só será declarado com essa evidência.
