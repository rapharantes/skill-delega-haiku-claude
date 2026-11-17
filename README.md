# skill-delega-haiku-claude

[![Estrelas](https://img.shields.io/github/stars/rapharantes/skill-delega-haiku-claude?style=flat)](https://github.com/rapharantes/skill-delega-haiku-claude/stargazers) [![Versão](https://img.shields.io/github/v/release/rapharantes/skill-delega-haiku-claude)](https://github.com/rapharantes/skill-delega-haiku-claude/releases)

`delegar-haiku` é uma skill para o Claude dividir tarefas grandes entre subagentes menores (Haiku e Sonnet) rodando em paralelo. O modelo principal planeja, revisa cada entrega, devolve para correção quando discorda e monta o resultado final.

No caso de puxar métricas de 3 contas de anúncio, o modelo de custo deste repositório, calibrado com a partida medida de um subagente, estima 79% menos custo e 40% menos turnos em série do que o principal fazendo tudo sozinho. No Claude Code, com o agente enxuto `executor-haiku`, a estimativa sobe para 91%. Em tarefa pequena, como escrever 5 títulos, delegar sai 3 vezes mais caro, e a skill manda o principal fazer direto.

Usa Codex, Cursor, Antigravity ou Gemini CLI? A versão para essas ferramentas é a [delegar-subagentes](https://github.com/rapharantes/delegar-subagentes).

## O que ela faz

A skill entra quando você pede para delegar a subagentes, usar multiagentes ou poupar tokens com eles. Antes de delegar, o principal passa por uma escada e para no primeiro degrau que resolve:

1. Trabalho determinístico (cruzar listas, somar, filtrar, converter formato) vira script. Não gasta token lendo dado e não erra conta. Rotina que se repete reaproveita o script da vez anterior.
2. Tarefa pequena, sem ferramenta ou com pouco material, o principal faz direto.
3. Decisão, conversa com você e qualquer ação irreversível ficam com o principal.
4. Só o volume vai para subagentes: muito material para ler, ou blocos independentes que podem rodar ao mesmo tempo.

O Haiku extrai dados, lê e resume arquivos, pesquisa na web, checa contra checklist e escreve variações de texto em lote. O Sonnet entra em código com especificação e teste quando há volume, e nas tarefas em que o Haiku errou mesmo depois de corrigido. O principal (Opus ou maior) planeja, revisa e integra. Em extração, leitura e pesquisa com o Haiku 5.5, o subagente roda com esforço baixo.

Para gastar menos, o briefing limita rodadas, porque cada rodada relê o contexto inteiro do subagente, e leitura de arquivos locais vai para o Explore, que parte mais leve. Quando o principal tem trabalho próprio, subagentes do mesmo tipo saem escalonados para reaproveitar o cache da partida.

Quando uma skill instalada muda o resultado de uma subtarefa (`xlsx` para planilha, por exemplo), o principal manda o subagente carregá-la antes de começar. É no máximo uma por subagente, porque a skill entra inteira no contexto dele. Numa checagem, o checklist da própria skill substitui o que o principal teria de escrever no briefing. Skills que delegam ou que montam o entregável final ficam com o principal.

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

No Claude Code (versão 2.1.275 ou mais nova), digite dentro de uma sessão:

```
/plugin install delegar-haiku --marketplace rapharantes/skill-delega-haiku-claude
```

Em versões mais antigas, são dois comandos:

```
/plugin marketplace add rapharantes/skill-delega-haiku-claude
/plugin install delegar-haiku@rapharantes
```

Para receber as versões novas, veja [Atualizações](#atualizações).

No app Claude (claude.ai): baixe o `delegar-haiku.zip` deste repositório, abra Customize > Skills, clique em "+", depois em "Create skill" > "Upload a skill", e envie o zip. A execução de código precisa estar ligada ("Code execution and file creation", ou "Create and edit files" no layout novo, em Settings > Capabilities). Passo a passo oficial: [Use skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

No Claude Code sem plugin: copie a pasta `delegar-haiku/` para `~/.claude/skills/` (vale para todos os seus projetos) ou para `.claude/skills/` dentro de um projeto. Documentação: [Extend Claude with skills](https://code.claude.com/docs/en/skills).

Recomendado no Claude Code: crie o agente `executor-haiku` em `~/.claude/agents/executor-haiku.md`. O arquivo está na seção "No Claude Code: agente enxuto" da skill. Ele fixa modelo e esforço, parte sem o CLAUDE.md, tem teto de turnos e uma lista fechada de ferramentas, que deixa de fora as ferramentas de escrita dos MCPs. Na medição, partiu de 8 mil tokens, contra 55 mil do general-purpose. Subtarefa que precisa de skill ou de conector vai para o general-purpose, a menos que você acrescente essas ferramentas ao executor.

A skill depende da ferramenta de subagentes (Agent) com escolha de modelo. Onde ela não existe, não há como delegar e o principal faz tudo direto.

Para usar, peça em linguagem normal: "delegue isso a subagentes", "use multiagentes nessa análise". No Claude Code também dá para chamar com `/delegar-haiku:delegar-haiku`, se instalou como plugin, ou com `/delegar-haiku`, se copiou a pasta.

## Atualizações

Não há como avisar automaticamente quem baixou a skill: o GitHub não informa quem clonou o repositório. Cada forma de instalação recebe as versões novas de um jeito:

- **Plugin do Claude Code:** o plugin acompanha os commits deste repositório. Ligue a atualização automática em `/plugin` > Marketplaces > rapharantes > Enable auto-update, ou rode `/plugin marketplace update rapharantes` quando quiser.
- **App Claude (zip) ou pasta copiada:** não há atualização automática. Para ser avisado por e-mail a cada versão nova, clique em **Watch** > **Custom** > **Releases** no topo desta página. Depois, baixe o zip da [release mais recente](https://github.com/rapharantes/skill-delega-haiku-claude/releases/latest) e envie em Customize > Skills; se o app recusar por já existir uma skill com o mesmo nome, apague a antiga antes.

O que mudou em cada versão fica nas [releases](https://github.com/rapharantes/skill-delega-haiku-claude/releases). A versão instalada aparece na última linha do `SKILL.md`.

## Quanto ela economiza

Isto é um modelo de custo, não um benchmark. A partida do subagente vem de medição; o resto sai do `calc_economia.py`, que usa os preços oficiais da API consultados em 31/10/2026 e as premissas abaixo. Rode o script com os seus números.

### O que foi medido

Em nov/2026, num ambiente com cerca de 15 conectores ligados, lendo o uso de tokens de cada requisição nas transcrições dos subagentes:

- Um subagente general-purpose parte de 92 mil tokens antes de fazer qualquer coisa: prompt de sistema, ferramentas e instruções dos conectores. O Explore, com menos ferramentas e sem CLAUDE.md, parte de 79 mil.
- No Claude Code no Windows, com 5 servidores MCP ligados, o general-purpose partiu de 55 mil tokens e o agente enxuto `executor-haiku` de 8 mil, 85% menos.
- No app, mesmo sem usar ferramenta, o subagente faz duas requisições; no Claude Code, uma.
- Cada rodada relê o contexto inteiro. Um Haiku de pesquisa com 7 chamadas de ferramenta em 4 rodadas processou 460 mil tokens e custou US$ 0,055. A contagem que o Claude mostra ao fim do subagente (126 mil, nesse caso) é o tamanho final do contexto, não o total.
- Subagentes do mesmo tipo disparados juntos pagam, cada um, a partida inteira. Disparado depois que o primeiro terminou, o segundo leu a partida do cache: no general-purpose, a partida inteira, e o subagente custou um sexto (US$ 0,002 contra US$ 0,013); no Explore, cerca de metade da partida.
- Dois Haiku de pesquisa em paralelo terminaram em 36 segundos no total.

A versão anterior deste README supunha partida de 50 mil tokens, porque lia a contagem final como total. Com a partida medida, a economia na leitura pesada caiu cerca de 10 pontos e o código com Sonnet num módulo só passou a dar prejuízo.

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
- Um subagente parte de S = 92 mil tokens, o valor medido; o script confere com um assert que o modelo reproduz a medição.
- Tudo que entra no contexto do principal é relido nos K = 20 turnos seguintes da sessão, a preço de leitura de cache. Quando o subagente lê no lugar do principal, essa releitura some.
- Briefing de 400 tokens por subagente e 80 tokens de saída por chamada de ferramenta.
- Tempo é contado em turnos em série, com a mesma duração por turno para todos os modelos. Se o Haiku responder mais rápido no seu uso, o ganho de tempo é maior que o mostrado.

### Resultado com as premissas base

Economia negativa quer dizer que delegar custou mais.

| Caso | Custo direto | Custo delegado | Economia | Tokens no principal (direto → delegado) | Tokens nos subagentes | Turnos em série (direto → delegado) |
|---|---|---|---|---|---|---|
| 5 títulos de anúncio | US$ 0,016 | US$ 0,049 | -197% | 63 mil → 132 mil | 93 mil | 1 → 3 |
| 60 variações de anúncio, com checagem de tamanho | US$ 0,096 | US$ 0,068 | +29% | 228 mil → 169 mil | 282 mil | 3 → 5 |
| Métricas de 3 contas de anúncio (30 mil tokens cada) | US$ 1,023 | US$ 0,218 | +79% | 2.869 mil → 184 mil | 1.293 mil | 10 → 6 |
| Pesquisa web lendo 8 páginas, 1 subagente | US$ 0,831 | US$ 0,160 | +81% | 2.502 mil → 135 mil | 1.625 mil | 13 → 15 |
| Pesquisa web lendo 8 páginas, 2 subagentes | US$ 0,831 | US$ 0,170 | +80% | 2.502 mil → 150 mil | 1.523 mil | 13 → 9 |
| Ler 12 arquivos de código e responder | US$ 0,670 | US$ 0,146 | +78% | 2.078 mil → 135 mil | 1.521 mil | 13 → 15 |
| Implementar módulo com teste (Sonnet) | US$ 0,528 | US$ 0,580 | -10% | 1.317 mil → 398 mil | 1.138 mil | 11 → 15 |

O que a tabela mostra:

- Ler material pesado é onde a skill ganha: de 78% a 81% menos custo em contas de anúncio, pesquisa web e leitura de código. O material vai para um modelo bem mais barato e deixa de ser relido no contexto do principal.
- O total de tokens nem sempre cai. Nos 5 títulos ele sobe de 63 mil para 225 mil. Nos casos de leitura pesada ele cai, porque some a releitura do material pelo principal. A economia é de custo, não de contagem de tokens.
- Velocidade vem do paralelismo. Com três subagentes nas contas de anúncio, 10 turnos em série viram 6. Um subagente sozinho soma dois turnos (despacho e integração).
- Código com Sonnet num módulo só sai 10% mais caro que fazer direto, e demora mais. Só compensa com vários módulos em paralelo.
- Com partida de 92 mil, quase todo subagente que lê material passa de 100 mil tokens de prompt, onde o Haiku 5.5 cobra 5 vezes mais. Dividir a pesquisa em dois subagentes não evita isso: custa um pouco mais que um (US$ 0,170 contra US$ 0,160), mas termina antes.

### Com outras premissas

| Caso | Base (C=60 mil, K=20, S=92 mil) | Sem releitura posterior (K=0) | Pessimista (C=20 mil, K=0, S=120 mil) | Claude Code, general-purpose (S=55 mil) | Claude Code, executor-haiku (S=8 mil) |
|---|---|---|---|---|---|
| 5 títulos de anúncio | -197% | -194% | -1118% | -169% | -133% |
| 60 variações de anúncio, com checagem de tamanho | +29% | +32% | -99% | +34% | +42% |
| Métricas de 3 contas de anúncio | +79% | +69% | +32% | +89% | +91% |
| Pesquisa web lendo 8 páginas, 1 subagente | +81% | +72% | +51% | +89% | +94% |
| Pesquisa web lendo 8 páginas, 2 subagentes | +80% | +71% | +34% | +90% | +92% |
| Ler 12 arquivos de código e responder | +78% | +70% | +42% | +89% | +93% |
| Implementar módulo com teste (Sonnet) | -10% | -31% | -85% | +15% | não se aplica |

O caso pessimista junta um principal leve (relê só 20 mil tokens por turno), sessão que acaba logo depois da tarefa e subagente que parte de 120 mil tokens. Mesmo assim a leitura pesada economiza de 32% a 51%. Lote de texto e código com Sonnet passam a custar mais que fazer direto.

As duas últimas colunas usam as partidas medidas no Claude Code. Com o `executor-haiku`, a leitura pesada economiza de 91% a 94%, porque o subagente parte de 8 mil tokens, fica abaixo do limite de 100 mil e cada rodada relê pouco. O executor é um agente Haiku; para código com Sonnet seria preciso um agente enxuto equivalente, por isso a célula fica sem valor.

### A partir de quanto material delegar compensa

Volume mínimo de material para delegar a um Haiku sair mais barato que o principal ler sozinho:

| Chamadas de ferramenta | Base | Sem releitura posterior (K=0) | Pessimista | Claude Code, general-purpose | Claude Code, executor-haiku |
|---|---|---|---|---|---|
| 1 | 3 mil tokens | 5 mil tokens | 21 mil tokens | 2 mil tokens | 2 mil tokens |
| 2 | 2 mil tokens | 2 mil tokens | 21 mil tokens | 1 mil tokens | já compensa |
| 3 | já compensa | já compensa | 20 mil tokens | já compensa | já compensa |
| 8 | já compensa | já compensa | 19 mil tokens | já compensa | já compensa |

Com as premissas base, a partir de 3 chamadas de ferramenta delegar já sai mais barato mesmo com pouco material, porque cada turno do principal relê 60 mil tokens. No caso pessimista o ponto de virada fica perto de 20 mil tokens. Com o `executor-haiku`, duas chamadas já bastam. A skill usa esses números no degrau 2 da escada: abaixo de ~5 mil tokens de material, ou ~20 mil num ambiente leve, o principal faz direto.

### Quanto custa errar

Uma rodada de CORRIGIR no caso das 3 contas custa US$ 0,037. Se um subagente erra duas vezes e o principal assume a parte dele, o total fica em 57% do custo de fazer tudo direto. Se os três erram, fica em 132%. O teto de uma rodada de correção limita o prejuízo a cerca de um terço acima do direto.

## Como recalcular

```
python3 calc_economia.py
```

Edite `PREMISSAS` (contexto do principal, partida do subagente, turnos de releitura) e `CENARIOS` com os seus casos. Os preços ficam em `PRECO`. Para medir a partida do subagente no seu ambiente, delegue uma tarefa que não usa ferramenta ("responda ok"): a contagem que o Claude Code mostra ao fim desse subagente é a partida. Num subagente que usa ferramentas, essa contagem é só o contexto final, não o total gasto.

## Arquivos

- `delegar-haiku/SKILL.md`: a skill.
- `delegar-haiku.zip`: a mesma pasta compactada, pronta para enviar no app.
- `.claude-plugin/marketplace.json`: o catálogo que permite instalar a skill como plugin do Claude Code.
- `calc_economia.py`: o modelo de custo, só com a biblioteca padrão do Python.
- `.github/ISSUE_TEMPLATE/avaliacao.yml`: o formulário de avaliação.

## Avaliação

Se a skill te ajudou, deixe uma estrela no topo desta página. Para dar uma nota de 1 a 5 e contar como foi usar, preencha a [avaliação](https://github.com/rapharantes/skill-delega-haiku-claude/issues/new?template=avaliacao.yml). Para relatar um problema ou sugerir melhoria, [abra uma issue](https://github.com/rapharantes/skill-delega-haiku-claude/issues/new).

## Licença

MIT. Pode usar, copiar e adaptar.

Feito por Raphael Arantes · [LinkedIn](https://www.linkedin.com/in/raphael-arantes/) · [GitHub](https://github.com/rapharantes)
