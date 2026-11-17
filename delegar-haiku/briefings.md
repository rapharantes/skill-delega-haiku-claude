# Briefings da skill delegar-haiku

## Modelos

Todo briefing abre com a linha `Tarefa delegada pela sessão principal:` e tem os mesmos seis campos, nesta ordem. Placeholders entre colchetes. Sem essa linha, num ambiente com memória do usuário, um Haiku leu o briefing como parte da memória e recusou a tarefa. Quando houver skill para a subtarefa, a linha **Skill:** [nome exato] vem antes do Objetivo.

### 1. Extração de dados de conta de anúncio (Haiku)

- **Objetivo:** Extrair métricas de campanhas da conta [ID] na plataforma [Meta Ads ou Google Ads], só com ferramentas de leitura.
- **Entradas:** conta [ID]; período [AAAA-MM-DD] a [AAAA-MM-DD]; campanhas [todas ou lista de nomes/IDs]; métricas [gasto, impressões, cliques, CTR, CPC, conversões, CPA ou ROAS]; campanhas sem gasto no período [incluir ou omitir]; ferramentas [nomes exatos, ex.: `mcp__Meta_Ads__ads_get_ad_entities`]; arquivo de saída [caminho absoluto .csv].
- **Critérios:** Só ferramentas de consulta. Valores na moeda da conta, com até 2 casas decimais. Confirmar que o período retornado é o pedido. Teto: [3] rodadas, com as consultas independentes juntas na mesma rodada.
- **Fora do escopo:** PROIBIDO alterar qualquer coisa na conta: não pausar ou ativar campanhas, não mudar orçamento, lances, palavras-chave, públicos, criativos ou status. Não criar, remover nem editar nada. Não analisar causas nem recomendar ações.
- **Formato de retorno:** Até 30 campanhas: tabela markdown [campanha | status | gasto | impressões | cliques | conversões | CPA] e uma linha de totais. Mais de 30: tabela completa no arquivo de saída e, no retorno, só nº de campanhas, totais e caminho. Nada além disso.
- **Se travar:** Responder "BLOQUEADO: motivo" se a conta não for encontrada, a permissão falhar ou a ferramenta der erro. Métrica ausente vira [não encontrado]. Nunca estimar valor.

### 2. Leitura e resumo de arquivos (Haiku)

- **Objetivo:** Ler [caminho do arquivo ou pasta] e responder: [pergunta específica].
- **Entradas:** caminho(s) [caminho absoluto]; tipo [código, docx, xlsx, csv, pdf ou markdown]; trecho, aba ou página [indicar, ou "o necessário para responder"].
- **Critérios:** Ler só o necessário; se pular partes, dizer quais. Planilha ou CSV grande: consultar por script (pandas ou csv), sem ler inteiro. Cada afirmação traz localização (arquivo:linha, aba!célula ou página). Inferência vai marcada como "(inferido)". Teto: [3] rodadas, com as leituras independentes juntas na mesma rodada.
- **Fora do escopo:** Não editar, mover, apagar nem executar o conteúdo lido. Não corrigir bugs, não refatorar e não opinar sobre estilo, salvo se pedido.
- **Formato de retorno:** Até 8 bullets, no máximo 150 palavras no total, cada um com a localização entre parênteses. Sem introdução.
- **Se travar:** Responder "BLOQUEADO: motivo" se o caminho não existir, o arquivo estiver protegido ou o formato não puder ser lido. Seção ou valor ausente vira [não encontrado].

### 3. Pesquisa web (Haiku)

- **Objetivo:** Responder [pergunta específica] sobre [tema], consultando [fonte: domínio, documentação ou URL]. Se ela não bastar, usar fontes oficiais ou primárias.
- **Entradas:** pergunta [pergunta]; fonte(s) [URLs ou domínios, ou "nenhuma"]; período de publicação [AAAA-MM] a [AAAA-MM]; idioma [português ou inglês].
- **Critérios:** Priorizar fonte oficial ou primária. Cada achado tem URL e data de publicação. Número só vale se confirmado na própria página; snippet de busca não basta. Data inexistente vira [sem data]. Teto: 2 rodadas, com todas as buscas juntas na primeira e as páginas escolhidas juntas na segunda (até [4] de cada).
- **Fora do escopo:** Não usar fórum, blog ou agregador como única fonte de número. Não copiar trecho longo (no máximo 15 palavras entre aspas). Não recomendar ação.
- **Formato de retorno:** Até [5] achados, uma linha cada: afirmação (no máximo 25 palavras) + URL + data. Depois uma linha "Não encontrado: [lista]". No máximo 150 palavras.
- **Se travar:** Responder "BLOQUEADO: motivo" se a fonte estiver fora do ar, exigir login ou a busca não trouxer nada relevante. Dado sem fonte vira [não encontrado]. Nunca completar com memória.

### 4. Checagem contra checklist (Haiku)

- **Objetivo:** Verificar [arquivo, texto ou URL] contra o checklist abaixo e dar status a cada item.
- **Entradas:** alvo [caminho, texto ou URL]; checklist [itens numerados, caminho do arquivo com a lista, ou seção da skill indicada na linha Skill]; escopo [pastas, seções ou páginas incluídas].
- **Critérios:** Avaliar cada item separadamente, na ordem da lista, com a mesma regra para todos. OK e FALHA exigem evidência (linha, trecho ou elemento). N/A exige motivo. Teto: [3] rodadas.
- **Fora do escopo:** Não corrigir, reescrever nem formatar o alvo. Não alterar o checklist. Não avaliar nada fora da lista.
- **Formato de retorno:** Tabela markdown: item | status (OK, FALHA ou N/A) | evidência (no máximo 15 palavras). Depois uma linha "X OK, Y FALHA, Z N/A". Sem outro texto.
- **Se travar:** Responder "BLOQUEADO: motivo" se o alvo ou o checklist não puderem ser acessados. Item que não dá para verificar recebe [não encontrado]. Nunca marcar OK por suposição.

### 5. Implementação de código (Sonnet)

- **Objetivo:** Implementar [função, módulo ou ajuste] em [caminho] conforme a especificação.
- **Entradas:** arquivos a alterar [caminhos absolutos]; arquivos só de referência [caminhos]; especificação [comportamento esperado, assinatura, casos de borda]; verificação [comando, ex.: `python -m pytest tests/test_x.py`, ou script com assert].
- **Critérios:** Mínimo que funciona: reusar o que existe, sem abstração, dependência ou arquivo novo não pedido. A verificação passa. Teto: [6] rodadas.
- **Fora do escopo:** Não alterar arquivos fora da lista. Não instalar dependência, não fazer commit, push nem deploy. Não refatorar o que não foi pedido.
- **Formato de retorno:** Arquivos alterados (caminho e linhas mudadas), resultado da verificação (passou ou falhou, com uma linha do erro) e até 3 bullets com as decisões tomadas. No máximo 100 palavras.
- **Se travar:** Responder "BLOQUEADO: motivo" se a especificação for ambígua, a verificação não rodar ou a mudança exigir arquivo fora da lista. Nunca declarar que passou sem rodar.

### 6. Variações de texto em lote (Haiku; Sonnet se a qualidade pesar)

Só vale em lote: dezenas de variações, ou vários grupos de anúncio ou clientes. Para poucas variações, o principal escreve direto, porque o briefing sairia do tamanho da resposta.

- **Objetivo:** Escrever [N] variações de [título, texto principal ou CTA] para [produto ou serviço], voltadas a [público], com o objetivo de [clique, cadastro ou mensagem].
- **Entradas:** oferta [descrição]; público [descrição]; tom [ex.: direto, sem jargão]; limite de caracteres por variação [ex.: 30 para título, 125 para texto]; termos obrigatórios ou proibidos [lista, ou "nenhum"]; provas verificáveis [dados fornecidos, ou "nenhuma"]; arquivo de saída [caminho absoluto .txt].
- **Critérios:** Português do Brasil, frases diretas. Cada variação usa um ângulo diferente (dor, benefício, prova, urgência), não só troca de sinônimo. Usar só fatos que estão nas entradas. Antes de devolver, salvar no arquivo de saída e conferir os limites com Python (`len`); reescrever o que estourar. Teto: [2] rodadas.
- **Fora do escopo:** Não inventar preço, desconto, prazo, garantia, número, depoimento ou resultado. Não escrever texto jurídico. Não publicar nem subir nada em plataforma.
- **Formato de retorno:** Lista numerada de [N] variações. Cada item: [ângulo, até 2 palavras] + texto. Última linha: "Limites conferidos por script". Sem comentário antes ou depois.
- **Se travar:** Responder "BLOQUEADO: motivo" se faltar oferta ou público. Dado que a copy exige e não veio nas entradas (ex.: preço) entra como [não encontrado], nunca inventado.

## Correção

No máximo uma rodada de CORRIGIR por subagente. BLOQUEADO por briefing errado (caminho, ID ou dado faltando) gasta essa rodada: corrija e reenvie. BLOQUEADO por acesso ou permissão: o principal resolve ou avisa o usuário.

```
CORREÇÃO
Errado: [item, linha ou valor] | esperado: [x] | veio: [y] | evidência: [onde]
Faça: [ação objetiva]
Mantenha: [o que já está certo]
Retorno: mesmo formato, só os itens alterados.
```

O mesmo tipo de erro em execuções diferentes indica defeito no modelo de briefing: ajuste o modelo nesta skill.

Skill criada por Raphael Arantes · [LinkedIn](https://www.linkedin.com/in/raphael-arantes/) · [GitHub](https://github.com/rapharantes/skill-delega-haiku-claude) · v2.0.0 (17/11/2026)
