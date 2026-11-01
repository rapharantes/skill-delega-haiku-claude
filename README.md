# skill-delega-haiku-claude

`delegar-haiku` é uma skill para o Claude dividir tarefas grandes entre subagentes menores (Haiku e Sonnet) rodando em paralelo. O modelo principal planeja, revisa cada entrega, devolve para correção quando discorda e monta o resultado final.

No caso de puxar métricas de 3 contas de anúncio, o modelo de custo deste repositório estima 89% menos custo e 40% menos turnos em série do que o principal fazendo tudo sozinho. Em tarefa pequena, como escrever 5 títulos, delegar sai 2,6 vezes mais caro, e a skill manda o principal fazer direto.

Usa Codex, Cursor, Antigravity ou Gemini CLI? A versão para essas ferramentas é a [delegar-subagentes](https://github.com/rapharantes/delegar-subagentes).

## O que ela faz

A skill entra quando você pede para delegar a subagentes, usar multiagentes ou poupar tokens com eles. Antes de delegar, o principal passa por uma escada e para no primeiro degrau que resolve:

1. Trabalho determinístico (cruzar listas, somar, filtrar, converter formato) vira script. Não gasta token lendo dado e não erra conta.
2. Tarefa pequena, sem ferramenta ou com pouco material, o principal faz direto.
3. Decisão, conversa com você e qualquer ação irreversível ficam com o principal.
4. Só o volume vai para subagentes: muito material para ler, ou blocos independentes que podem rodar ao mesmo tempo.

O Haiku extrai dados, lê e resume arquivos, pesquisa na web, checa contra checklist e escreve variações de texto em lote. O Sonnet entra em código com especificação e teste quando há volume, e nas tarefas em que o Haiku errou mesmo depois de corrigido. O principal (Opus ou maior) planeja, revisa e integra.

O principal é o gerente. Cada entrega passa por uma checagem barata, sem reler o material: formato, totais, uma ou duas citações conferidas e, em código, o teste rodado e o diff lido. Depois recebe um veredito:

| Veredito | Quando | O que o principal faz |
|---|---|---|
| ACEITO | entrega correta | integra |
| AJUSTE | erro pequeno | corrige ele mesmo, porque devolver custa mais um turno |
| CORRIGIR | erro que exige reabrir o material | devolve ao mesmo subagente com uma mensagem de correção, uma vez só |
| ASSUMIR | segunda falha ou erro de raciocínio | faz direto ou passa para o Sonnet |

O limite de uma rodada de correção existe porque o vai e volta sem fim come a economia. Os números estão mais abaixo.

A skill traz seis modelos de briefing com os mesmos campos (objetivo, entradas, critérios, fora do escopo, formato de retorno, o que fazer se travar): extração de dados de conta de anúncio, leitura e resumo de arquivos, pesquisa web, checagem contra checklist, implementação de código e variações de texto em lote. Todo briefing fixa um teto de chamadas de ferramenta e um formato de retorno fechado.

Subagente nunca executa ação irreversível: alterar campanha, enviar mensagem, publicar, apagar, fazer push ou deploy. Isso fica com o principal e só acontece com a sua confirmação.

## Instalação

No app Claude (claude.ai): baixe o `delegar-haiku.zip` deste repositório, abra Customize > Skills, clique em "+", depois em "Create skill" > "Upload a skill", e envie o zip. A execução de código precisa estar ligada ("Code execution and file creation", ou "Create and edit files" no layout novo, em Settings > Capabilities). Passo a passo oficial: [Use skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

No Claude Code: copie a pasta `delegar-haiku/` para `~/.claude/skills/` (vale para todos os seus projetos) ou para `.claude/skills/` dentro de um projeto. Documentação: [Extend Claude with skills](https://code.claude.com/docs/en/skills).

A skill depende da ferramenta de subagentes (Agent) com escolha de modelo. Onde ela não existe, não há como delegar e o principal faz tudo direto.

Para usar, peça em linguagem normal: "delegue isso a subagentes", "use multiagentes nessa análise". No Claude Code também dá para chamar com `/delegar-haiku`.

## Quanto ela economiza

Isto é um modelo de custo, não um benchmark. A única medição real veio da criação da skill: um subagente com uma chamada de ferramenta processou cerca de 100 mil tokens de Haiku. O resto sai do `calc_economia.py`, que usa os preços oficiais da API consultados em 31/10/2026 e as premissas abaixo. Rode o script com os seus números.

### Preços usados (US$ por milhão de tokens)

| Modelo | Entrada | Escrita de cache (5 min) | Leitura de cache | Saída |
|---|---|---|---|---|
| Opus 5.5 | 4,00 | 5,00 | 0,20 | 20,00 |
| Sonnet 5.5 | 2,00 | 2,50 | 0,10 | 10,00 |
| Haiku 5.5 (prompt até 100 mil tokens) | 0,10 | 0,125 | 0,01 | 0,50 |
| Haiku 5.5 (prompt acima de 100 mil tokens) | 0,50 | 0,625 | 0,05 | 2,50 |

Fonte: [preços da Claude API](https://platform.claude.com/docs/en/about-claude/pricing). Nos planos do app, o limite de uso também pesa modelo e volume, mas a conta exata não é pública; o preço da API serve aqui como medida comum.

### Premissas

- O principal é o Opus 5.5 e relê C = 60 mil tokens de contexto a cada turno (prompt de sistema, ferramentas e conversa).
- Um subagente parte de S = 50 mil tokens. É o valor que reproduz a medição de ~100 mil tokens em duas requisições; o script confere isso com um assert.
- Tudo que entra no contexto do principal é relido nos K = 20 turnos seguintes da sessão, a preço de leitura de cache. Quando o subagente lê no lugar do principal, essa releitura some.
- Briefing de 400 tokens por subagente e 80 tokens de saída por chamada de ferramenta.
- Tempo é contado em turnos em série, com a mesma duração por turno para todos os modelos. Se o Haiku responder mais rápido no seu uso, o ganho de tempo é maior que o mostrado.

### Resultado com as premissas base

Economia negativa quer dizer que delegar custou mais.

| Caso | Custo direto | Custo delegado | Economia | Tokens no principal (direto → delegado) | Tokens nos subagentes | Turnos em série (direto → delegado) |
|---|---|---|---|---|---|---|
| 5 títulos de anúncio | US$ 0,016 | US$ 0,043 | -165% | 63 mil → 132 mil | 51 mil | 1 → 3 |
| 60 variações de anúncio, com checagem de tamanho | US$ 0,096 | US$ 0,062 | +35% | 228 mil → 169 mil | 156 mil | 3 → 5 |
| Métricas de 3 contas de anúncio (30 mil tokens cada) | US$ 1,023 | US$ 0,112 | +89% | 2.869 mil → 184 mil | 789 mil | 10 → 6 |
| Pesquisa web lendo 8 páginas, 1 subagente | US$ 0,831 | US$ 0,085 | +90% | 2.502 mil → 135 mil | 1.079 mil | 13 → 15 |
| Pesquisa web lendo 8 páginas, 2 subagentes | US$ 0,831 | US$ 0,082 | +90% | 2.502 mil → 150 mil | 935 mil | 13 → 9 |
| Ler 12 arquivos de código e responder | US$ 0,670 | US$ 0,060 | +91% | 2.078 mil → 135 mil | 975 mil | 13 → 15 |
| Implementar módulo com teste (Sonnet) | US$ 0,528 | US$ 0,433 | +18% | 1.317 mil → 398 mil | 676 mil | 11 → 15 |

O que a tabela mostra:

- Ler material pesado é onde a skill ganha: de 89% a 91% menos custo em contas de anúncio, pesquisa web e leitura de código. O material vai para um modelo 40 vezes mais barato na entrada e deixa de ser relido no contexto do principal.
- O total de tokens nem sempre cai. Nos 5 títulos ele sobe de 63 mil para 183 mil. Nos casos de leitura pesada ele cai, porque some a releitura do material pelo principal. A economia é de custo, não de contagem de tokens.
- Velocidade vem do paralelismo. Com três subagentes nas contas de anúncio, 10 turnos em série viram 6. Um subagente sozinho soma dois turnos (despacho e integração).
- Código com Sonnet economiza pouco num módulo só (18%) e demora mais. Compensa com vários módulos em paralelo.
- Na pesquisa grande, dois subagentes custam o mesmo que um (US$ 0,082 contra US$ 0,085) e terminam antes, porque o Haiku 5.5 cobra 5 vezes mais por token quando o prompt passa de 100 mil.

### Com premissas piores

| Caso | Base (C=60 mil, K=20, S=50 mil) | Sem releitura posterior (K=0) | Pessimista (C=20 mil, K=0, S=100 mil) |
|---|---|---|---|
| 5 títulos de anúncio | -165% | -161% | -956% |
| 60 variações de anúncio, com checagem de tamanho | +35% | +39% | -76% |
| Métricas de 3 contas de anúncio | +89% | +85% | +40% |
| Pesquisa web lendo 8 páginas, 1 subagente | +90% | +86% | +56% |
| Pesquisa web lendo 8 páginas, 2 subagentes | +90% | +87% | +42% |
| Ler 12 arquivos de código e responder | +91% | +88% | +49% |
| Implementar módulo com teste (Sonnet) | +18% | +4% | -64% |

O caso pessimista junta um ambiente leve (o principal relê só 20 mil tokens por turno), sessão que acaba logo depois da tarefa e subagente que parte de 100 mil tokens. Mesmo assim a leitura pesada economiza de 40% a 56%. Lote de texto e código com Sonnet passam a custar mais que fazer direto.

### A partir de quanto material delegar compensa

Volume mínimo de material para delegar a um Haiku sair mais barato que o principal ler sozinho:

| Chamadas de ferramenta | Base | Sem releitura posterior (K=0) | Pessimista |
|---|---|---|---|
| 1 | 2 mil tokens | 4 mil tokens | 18 mil tokens |
| 2 | 1 mil tokens | 1 mil tokens | 18 mil tokens |
| 3 | já compensa | já compensa | 17 mil tokens |
| 8 | já compensa | já compensa | 15 mil tokens |

Com as premissas base, a partir de 3 chamadas de ferramenta delegar já sai mais barato mesmo com pouco material, porque cada turno do principal relê 60 mil tokens. No caso pessimista o ponto de virada fica entre 15 mil e 18 mil tokens. A skill usa esses números no degrau 2 da escada: abaixo de ~5 mil tokens de material, ou ~20 mil num ambiente leve, o principal faz direto.

### Quanto custa errar

Uma rodada de CORRIGIR no caso das 3 contas custa US$ 0,031. Se um subagente erra duas vezes e o principal assume a parte dele, o total fica em 46% do custo de fazer tudo direto. Se os três erram, fica em 120%. O teto de uma rodada de correção limita o prejuízo a cerca de 20% acima do direto.

## Como recalcular

```
python3 calc_economia.py
```

Edite `PREMISSAS` (contexto do principal, partida do subagente, turnos de releitura) e `CENARIOS` com os seus casos. Os preços ficam em `PRECO`. Para medir a partida do subagente no seu ambiente, delegue uma tarefa curta e veja quantos tokens ele gastou; o Claude Code mostra essa contagem ao fim de cada subagente.

## Arquivos

- `delegar-haiku/SKILL.md`: a skill.
- `delegar-haiku.zip`: a mesma pasta compactada, pronta para enviar no app.
- `calc_economia.py`: o modelo de custo, só com a biblioteca padrão do Python.

## Licença

MIT. Pode usar, copiar e adaptar.

Feito por Raphael Arantes · [LinkedIn](https://www.linkedin.com/in/raphael-arantes/) · [GitHub](https://github.com/rapharantes)
