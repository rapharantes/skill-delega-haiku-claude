# Referência da skill delegar-haiku: custos e otimizações

Leia só quando precisar decidir algo que o SKILL.md não resolve: instalar o agente enxuto, escalonar subagentes, dividir um bloco grande ou explicar o custo ao usuário.

## Quanto custa um subagente

Cada subagente começa do zero: carrega o próprio prompt de sistema, as ferramentas e as instruções dos conectores, e não vê a conversa. Medições de nov/2026, num ambiente com cerca de 15 conectores, lendo o uso de cada requisição nas transcrições:
- Partida de 92 mil tokens no general-purpose e 79 mil no Explore, que tem menos ferramentas. Mesmo sem usar ferramenta, o subagente faz duas requisições.
- No Claude Code no Windows, com 5 servidores MCP: partida de 55 mil no general-purpose e de 8 mil no executor-haiku descrito abaixo, 85% menos.
- Cada rodada relê o contexto inteiro. Um Haiku de pesquisa com 7 chamadas de ferramenta em 4 rodadas processou 460 mil tokens (US$ 0,055). A contagem que o Claude mostra ao fim do subagente é o contexto final (126 mil, nesse caso), não o total.
- Acima de 100 mil tokens de prompt o Haiku 5.5 cobra 5x por token. Com partida de 92 mil, quase todo subagente que lê material passa desse limite.
- Subagentes do mesmo tipo disparados juntos pagam a partida inteira cada um. Disparado depois que o primeiro terminou, o segundo leu a partida do cache: inteira no general-purpose (custou um sexto, US$ 0,002 contra US$ 0,013), metade no Explore.
- Dois Haiku em paralelo terminaram em 36 segundos no total, o tempo do mais lento.

Em preço de API (out/2026), o token de entrada do Haiku 5.5 custa 1/40 do Opus 5.5 até 100 mil tokens de prompt e 1/8 acima disso. Do lado do principal, o custo fixo de delegar é o briefing que ele escreve e os turnos de despacho e integração. No plano de assinatura, as requisições dos subagentes contam nos mesmos limites de uso da conversa principal: delegar não tira o trabalho da cota, só compensa quando o mesmo trabalho sairia mais caro no principal. Daí as regras:
- sem ferramenta ou com pouco material, delegar sai mais caro do que fazer direto;
- briefing bom é curto e faz o subagente terminar em poucas rodadas;
- um subagente sozinho não acelera: soma dois turnos de espera. Ganho de tempo vem de dois ou mais em paralelo.

## Primeiro benchmark (nov/2026)

Quatro tarefas com gabarito (pesquisa na documentação, leitura de código, cruzamento de planilhas e uma tarefa pequena), sem e com a skill, duas vezes cada, no Claude Code com o Opus como principal. A nota foi máxima nos dois modos. Com a skill (v1.2.0), o custo subiu de 45% a 70%: carregar a skill gravava uns 9 mil tokens a mais no cache do Opus, mesmo quando ela decidia não delegar, e na pesquisa o principal fez 8 requisições contra 3. Por isso a v2 deixa no SKILL.md só a decisão e manda abrir os outros arquivos apenas quando for delegar.

## No Claude Code: agente enxuto

Os tipos prontos herdam todas as ferramentas e carregam o CLAUDE.md. Um agente definido em `~/.claude/agents/executor-haiku.md` fixa modelo e esforço, tira o CLAUDE.md da partida, impõe teto de turnos e fecha a lista de ferramentas:

```markdown
---
name: executor-haiku
description: Executa subtarefas de leitura, extração e pesquisa delegadas pela skill delegar-haiku.
model: haiku
effort: low
maxTurns: 6
omitClaudeMd: true
tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
---
Execute só o briefing recebido e devolva no formato pedido. Não altere arquivos de projeto, contas nem configurações.
```

Com `tools` fechado, as ferramentas de MCP ficam de fora, inclusive as de escrita. Para extrair dados de anúncio, acrescente só os nomes exatos das ferramentas de leitura e, em `mcpServers`, só o servidor delas. No Claude Code, ele partiu de 8 mil tokens, contra 55 mil do general-purpose. Sem a ferramenta Skill, ele não carrega skills: para isso, acrescente `Skill` ao `tools` ou use o general-purpose. Para medir a partida no seu ambiente, delegue uma tarefa sem ferramenta ("responda ok"): a contagem ao fim é a partida. O Bash continua podendo gravar arquivo, o que serve ao retorno em arquivo. `effort: low` vale para o Haiku 5.5; `omitClaudeMd` exige Claude Code v2.1.271 ou mais recente.

## Escalonar subagentes do mesmo tipo

Disparados juntos, subagentes do mesmo tipo pagam a partida inteira cada um. Se o principal tem trabalho próprio a fazer, dispare um primeiro e os demais do mesmo tipo junto com a próxima chamada dele, para lerem a partida do cache. Mensagem extra do principal só para escalonar compensa a partir de 3 ou 4 subagentes do mesmo tipo.

## Dividir um bloco grande

Partir um bloco em dois soma uma partida e as releituras dela a cada rodada, e com partida de ~90 mil tokens os dois pedaços passam de 100 mil do mesmo jeito: só vale quando o usuário pediu rapidez.

## Segurança

- Subagente nunca executa ação irreversível: alterar status, orçamento ou lance em conta de anúncio, enviar e-mail ou mensagem, publicar, apagar, mexer em credenciais, fazer push ou deploy. Se a subtarefa exige isso, ela é do principal, com confirmação do usuário.
- Os tipos prontos de subagente não bloqueiam as ferramentas de escrita dos MCPs, nem o Explore, que também tem Bash. A proteção é o briefing e a escolha do que delegar: não delegue tarefa cujo caminho natural passe por ferramenta de escrita. No Claude Code, o agente enxuto com `tools` fechado bloqueia de fato.
- Não coloque chaves, tokens ou senhas no briefing.

Skill criada por Raphael Arantes · [LinkedIn](https://www.linkedin.com/in/raphael-arantes/) · [GitHub](https://github.com/rapharantes/skill-delega-haiku-claude) · v2.0.0 (17/11/2026)
