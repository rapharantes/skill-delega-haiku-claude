// Benchmark da skill delegar-haiku: as mesmas tarefas, com gabarito, sem e com a skill.
//   node bench.js preparar               clona o repositorio de teste, gera planilhas e gabarito
//   node bench.js rodar [t modo rep]     roda as 16 execucoes (ou um caso) e grava resultados-v2.jsonl
//   node bench.js rodar rep 1            roda so a repeticao 1 (8 execucoes)
//   node bench.js resumo                 tabela por tarefa e modo
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const W = __dirname;                                       // pasta de trabalho dos runs
const G = path.join(path.dirname(W), 'bench-gabarito');    // gabarito fora da pasta de trabalho
const RES = path.join(G, 'resultados-v2.jsonl');
const LISTA = [1, 2, 4, 5];   // T3 (planilhas) saiu da v2: a decisao certa ali e script, como em T4
const PROJ = path.join(os.homedir(), '.claude', 'projects');
const CLAUDE = fs.existsSync(path.join(os.homedir(), '.local', 'bin', 'claude.exe'))
  ? path.join(os.homedir(), '.local', 'bin', 'claude.exe') : 'claude';

// US$ por milhao: entrada, escrita de cache 5 min, escrita 1 h, leitura de cache, saida (API, out/2026)
const PRECO = { opus: [4, 5, 8, 0.2, 20], sonnet: [2, 2.5, 4, 0.1, 10],
  haiku: [0.1, 0.125, 0.2, 0.01, 0.5], haiku_longo: [0.5, 0.625, 1, 0.05, 2.5] };

const RESP = ' Grave a resposta no arquivo indicado e, no fim, responda só "pronto".';
const TAREFAS = {
  1: 'Responda com base na documentação oficial do Claude Code (https://code.claude.com/docs). Grave em resposta_t1.json um objeto JSON com as chaves q1 a q6:\n' +
     'q1: a atualização automática em segundo plano de um marketplace de plugins de terceiros vem ligada ou desligada por padrão?\n' +
     'q2: quais níveis de effort o Haiku 5.5 aceita e qual é o padrão?\n' +
     'q3: a partir de quantos caracteres a descrição de uma skill é truncada na listagem de skills?\n' +
     'q4: qual versão mínima do Claude Code o campo omitClaudeMd de subagentes exige?\n' +
     'q5: quantos subagentes podem rodar ao mesmo tempo, por padrão, antes de o limite de concorrência bloquear novos?\n' +
     'q6: por padrão, quantas camadas de subagentes abaixo da conversa principal podem ser criadas?' + RESP,
  2: 'No repositório requests/ (clone do psf/requests, versão 2.32.3), para cada arquivo .py em requests/src/requests: liste as classes definidas no nível do módulo e escreva uma frase dizendo o que o arquivo faz. ' +
     'Grave em resposta_t2.json no formato {"nome.py": {"classes": ["..."], "resumo": "..."}}.' + RESP,
  3: 'As planilhas A.csv e B.csv têm leads identificados pela coluna id. Compare pelo id, ignorando diferenças de maiúsculas e minúsculas e espaços no início e no fim dos textos. ' +
     'Grave em resposta_t3.json: {"so_a": quantidade de ids só em A, "so_b": quantidade de ids só em B, "divergentes": quantidade de ids presentes nas duas com algum campo diferente, "ids_divergentes": [lista desses ids]}.' + RESP,
  5: 'A pasta atas/ tem 10 atas de reunião. Para cada arquivo, informe o orçamento aprovado no final da reunião e quem ficou responsável pela entrega. ' +
     'Grave em resposta_t5.json no formato {"ata_01.txt": {"orcamento": "R$ ...", "responsavel": "..."}}.' + RESP,
  4: 'Escreva 5 títulos de anúncio de até 30 caracteres cada para: curso online de Excel para iniciantes, R$ 97, com 30 dias de garantia. Grave em resposta_t4.json como {"titulos": ["..."]}.' + RESP,
};
const PREFIXO = 'Use a skill delegar-haiku (carregue-a com a ferramenta Skill antes de começar) para executar a tarefa abaixo.\n\n';

function rng(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function embaralha(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const csv = linhas => 'id,nome,email,cidade,valor\n' + linhas.map(l => [l.id, l.nome, l.email, l.cidade, l.valor].join(',')).join('\n') + '\n';

function preparar() {
  fs.mkdirSync(G, { recursive: true });
  const repo = path.join(W, 'requests');
  if (!fs.existsSync(repo)) cp.execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'v2.32.3', 'https://github.com/psf/requests', repo]);
  const src = path.join(repo, 'src', 'requests'), t2 = {};
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.py')).sort())
    t2[f] = [...fs.readFileSync(path.join(src, f), 'utf8').matchAll(/^class\s+(\w+)/gm)].map(m => m[1]);
  // B = A sem 137 ids, com 95 ids novos, 58 divergencias reais e 40 diferencas so de caixa e espacos
  const r = rng(42), cidades = ['Belo Horizonte', 'Contagem', 'Betim', 'São Paulo', 'Rio de Janeiro', 'Curitiba'];
  const lead = i => ({ id: 'L' + String(i).padStart(5, '0'), nome: 'Cliente ' + i, email: `cliente${i}@exemplo.com.br`,
    cidade: cidades[Math.floor(r() * cidades.length)], valor: (100 + Math.floor(r() * 90000) / 100).toFixed(2) });
  const A = Array.from({ length: 2000 }, (_, i) => lead(i + 1));
  const idx = embaralha(A.map((_, i) => i), r);
  const soA = new Set(idx.slice(0, 137)), div = idx.slice(137, 195), caixa = new Set(idx.slice(195, 235));
  const B = A.map(l => ({ ...l }));
  div.forEach((i, k) => { if (k % 2) B[i].valor = (+B[i].valor + 10).toFixed(2);
    else B[i].cidade = cidades[(cidades.indexOf(B[i].cidade) + 1) % cidades.length]; });
  for (const i of caixa) { B[i].email = B[i].email.toUpperCase(); B[i].nome = '  ' + B[i].nome + ' '; }
  const novos = Array.from({ length: 95 }, (_, k) => lead(2001 + k));
  fs.writeFileSync(path.join(W, 'A.csv'), csv(A));
  fs.writeFileSync(path.join(W, 'B.csv'), csv(embaralha(B.filter((_, i) => !soA.has(i)).concat(novos), r)));
  // T5: 10 atas longas; o orcamento final e o responsavel final aparecem depois de valores e nomes descartados
  const r5 = rng(7), pega = a => a[Math.floor(r5() * a.length)];
  const S = ['O time de mídia', 'A equipe comercial', 'O coordenador do projeto', 'A analista de dados', 'O gerente da conta', 'O pessoal de criação', 'A área financeira', 'O suporte ao cliente'];
  const V = ['comentou que', 'lembrou que', 'reforçou que', 'sugeriu que', 'observou que', 'explicou que', 'avisou que', 'destacou que'];
  const O = ['o cronograma das campanhas', 'a planilha de leads', 'o relatório semanal', 'a integração com o CRM', 'o painel de métricas', 'a revisão dos criativos', 'o calendário de postagens', 'a configuração do pixel'];
  const C = ['precisa de ajuste até sexta', 'ainda depende de aprovação', 'foi revisado ontem', 'segue sem pendências', 'vai mudar no próximo ciclo', 'tem um ponto em aberto com o cliente', 'será discutido na próxima reunião', 'já está documentado no drive'];
  const pessoas = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Íris', 'João'];
  const reais = v => 'R$ ' + v.toLocaleString('pt-BR') + ',00';
  const FINAL = ['No fim da reunião, a diretoria aprovou em definitivo o valor de X.', 'Depois de nova rodada, fechou-se o orçamento em X, valor final do projeto.', 'Ficou acertado, como valor final, X.'];
  const t5 = {}; fs.mkdirSync(path.join(W, 'atas'), { recursive: true });
  for (let d = 1; d <= 10; d++) {
    const linhas = Array.from({ length: 450 }, () => `${pega(S)} ${pega(V)} ${pega(O)} ${pega(C)}.`);
    const vals = new Set(); while (vals.size < 4) vals.add(20000 + 500 * Math.floor(r5() * 360));
    const [v1, v2, v3, v4] = [...vals], p1 = pega(pessoas); let p2 = pega(pessoas); while (p2 === p1) p2 = pega(pessoas);
    const em = (de, ate) => Math.floor(450 * (de + r5() * (ate - de)));
    const fatos = [[em(0.05, 0.25), `A proposta inicial apresentada foi de ${reais(v1)}.`], [em(0.05, 0.3), `Inicialmente, ${p1} ficaria responsável pela entrega.`],
      [em(0.35, 0.6), `O cliente pediu ajuste e surgiu uma contraproposta de ${reais(v2)}, que ficou em análise.`],
      [em(0.4, 0.7), `Por conflito de agenda, a responsabilidade pela entrega passou para ${p2}.`],
      [em(0.7, 0.85), pega(FINAL).replace('X', reais(v3))], [em(0.88, 0.98), `Alguém lembrou que um projeto parecido custou ${reais(v4)} no ano passado, mas isso não muda o acordo.`]];
    for (const [i, f] of fatos.sort((a, b) => b[0] - a[0])) linhas.splice(i, 0, f);
    const nome = `ata_${String(d).padStart(2, '0')}.txt`;
    fs.writeFileSync(path.join(W, 'atas', nome), `Ata de reunião ${d}\n\n` + linhas.join('\n') + '\n');
    t5[nome] = { orcamento: v3, responsavel: p2 };
  }
  const t3 = { so_a: 137, so_b: 95, divergentes: 58, ids: div.map(i => A[i].id).sort() };
  fs.writeFileSync(path.join(G, 'gabarito.json'), JSON.stringify({ t2, t3, t5 }, null, 1));
  console.log('preparado:', Object.keys(t2).length, 'arquivos em T2,', Object.values(t2).flat().length, 'classes; T3 com', A.length, 'e', B.length - 137 + 95, 'linhas');
}

function ler(t) { try { return JSON.parse(fs.readFileSync(path.join(W, `resposta_t${t}.json`), 'utf8')); } catch { return null; } }
function nota(t) {
  const r = ler(t), g = JSON.parse(fs.readFileSync(path.join(G, 'gabarito.json'), 'utf8'));
  if (!r) return 0;
  if (t === 1) {
    const s = k => JSON.stringify(r[k] ?? '').toLowerCase();
    const ok = [/deslig|\boff\b|disabled|false/.test(s('q1')),
      ['low', 'medium', 'high', 'xhigh', 'max'].every(n => s('q2').includes(n)) && /(padr|default).{0,25}medium|medium.{0,25}(padr|default)/.test(s('q2')),
      /1[.,]?536/.test(s('q3')), /2\.1\.271/.test(s('q4')), /\b20\b/.test(s('q5')), /\b3\b|tr[eê]s/.test(s('q6'))];
    return ok.filter(Boolean).length / ok.length;
  }
  if (t === 2) {
    const dado = {}; for (const k of Object.keys(r)) dado[path.basename(k)] = r[k];
    const arqs = Object.keys(g.t2); let f1 = 0, resumo = 0;
    for (const f of arqs) {
      const esp = new Set(g.t2[f]), veio = new Set(dado[f]?.classes || []);
      const tp = [...veio].filter(c => esp.has(c)).length;
      f1 += esp.size + veio.size === 0 ? 1 : 2 * tp / (esp.size + veio.size);
      if (String(dado[f]?.resumo || '').trim().split(/\s+/).length >= 5) resumo++;
    }
    return +(0.8 * f1 / arqs.length + 0.2 * resumo / arqs.length).toFixed(3);
  }
  if (t === 3) {
    const ids = new Set((r.ids_divergentes || []).map(String)), esp = new Set(g.t3.ids);
    const inter = [...ids].filter(i => esp.has(i)).length, uni = new Set([...ids, ...esp]).size;
    return (+(Number(r.so_a) === g.t3.so_a) + +(Number(r.so_b) === g.t3.so_b) + +(Number(r.divergentes) === g.t3.divergentes) + inter / uni) / 4;
  }
  if (t === 5) {
    const dado = {}; for (const k of Object.keys(r)) dado[path.basename(k)] = r[k];
    const arqs = Object.keys(g.t5); let pts = 0;
    for (const f of arqs) {
      const cents = String(dado[f]?.orcamento ?? '').replace(/,\d{2}\b/, '').replace(/\D/g, '');
      if (Number(cents) === g.t5[f].orcamento) pts += 0.5;
      if (String(dado[f]?.responsavel ?? '').trim().toLowerCase() === g.t5[f].responsavel.toLowerCase()) pts += 0.5;
    }
    return pts / arqs.length;
  }
  const tt = r.titulos || [];
  return tt.length === 5 ? tt.filter(x => typeof x === 'string' && x.trim() && x.length <= 30).length / 5 : 0;
}

function usoArquivo(f) {
  const reqs = new Map();
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    let d; try { d = JSON.parse(l); } catch { continue; }
    const m = d.message || {}; if (d.type === 'assistant' && m.usage) reqs.set(m.id || d.uuid, [m.usage, m.model || '']);
  }
  let tokens = 0, custo = 0;
  for (const [u, modelo] of reqs.values()) {
    const w = u.cache_creation_input_tokens || 0, w1 = u.cache_creation?.ephemeral_1h_input_tokens || 0;
    const ent = u.input_tokens || 0, rd = u.cache_read_input_tokens || 0, sai = u.output_tokens || 0, prompt = ent + w + rd;
    const fam = /haiku/.test(modelo) ? (prompt > 100000 ? 'haiku_longo' : 'haiku') : /sonnet/.test(modelo) ? 'sonnet' : 'opus';
    const [pe, p5, p1, pl, ps] = PRECO[fam];
    tokens += prompt + sai; custo += (ent * pe + (w - w1) * p5 + w1 * p1 + rd * pl + sai * ps) / 1e6;
  }
  return { tokens, custo };
}
function transcricoes(sid) {
  const r = { tok_principal: 0, tok_sub: 0, custo_api: 0, subagentes: 0, executor: 0, skill: false };
  for (const p of sid ? fs.readdirSync(PROJ) : []) {
    const main = path.join(PROJ, p, sid + '.jsonl');
    if (!fs.existsSync(main)) continue;
    const u = usoArquivo(main), txt = fs.readFileSync(main, 'utf8');
    r.tok_principal = u.tokens; r.custo_api += u.custo;
    r.skill = /"name":"Skill","input":\{[^}]*delegar-haiku|Base directory for this skill:[^"]*delegar-haiku/.test(txt);
    const sd = path.join(PROJ, p, sid, 'subagents');
    for (const f of fs.existsSync(sd) ? fs.readdirSync(sd).filter(f => f.endsWith('.jsonl')) : []) {
      const s = usoArquivo(path.join(sd, f)); r.tok_sub += s.tokens; r.custo_api += s.custo; r.subagentes++;
      try { if (/executor-haiku/.test(fs.readFileSync(path.join(sd, f.replace(/\.jsonl$/, '.meta.json')), 'utf8'))) r.executor++; } catch {}
    }
  }
  r.custo_api = +r.custo_api.toFixed(4);
  return r;
}

function rodarUm(t, modo, rep) {
  for (const f of fs.readdirSync(W)) if (/^resposta_t\d\.json$/.test(f)) fs.unlinkSync(path.join(W, f));
  const ferr = 'Read,Grep,Glob,Bash,Write,Edit,WebFetch,WebSearch,Agent,Skill';   // v2: o modo sem skill tambem tem a ferramenta Skill
  const args = ['-p', (modo === 'B' ? PREFIXO : '') + TAREFAS[t], '--model', 'opus', '--output-format', 'json', '--allowedTools', ferr];
  const ini = Date.now();
  const p = cp.spawnSync(CLAUDE, args, { cwd: W, input: '', encoding: 'utf8', timeout: 15 * 60e3, maxBuffer: 64e6 });
  let out; try { out = JSON.parse(p.stdout); } catch { out = { is_error: true, result: String(p.stderr || p.stdout || p.error).slice(0, 300) }; }
  const linha = { t, modo, rep, nota: nota(t), custo_cc: out.total_cost_usd ?? null, ...transcricoes(out.session_id),
    seg: Math.round((Date.now() - ini) / 1000), turnos: out.num_turns ?? null, sessao: out.session_id || null,
    erro: out.is_error ? String(out.result).slice(0, 200) : null };
  fs.appendFileSync(RES, JSON.stringify(linha) + '\n');
  console.log(JSON.stringify(linha));
  if (out.is_error && /limit/i.test(String(out.result))) { console.log('Parando: limite de uso do plano atingido.'); process.exit(2); }
}

function resumo() {
  const L = fs.readFileSync(RES, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(l => l.rep >= 1);
  const med = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('| Tarefa | Modo | Nota | Custo Claude Code (US$) | Custo API (US$) | Tokens principal | Tokens subagentes | Subagentes | Tempo (s) | Skill carregada | n |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of LISTA) for (const m of ['A', 'B']) {
    const x = L.filter(l => l.t === t && l.modo === m); if (!x.length) continue;
    console.log(`| T${t} | ${m === 'A' ? 'sem skill' : 'com skill'} | ${med(x.map(l => l.nota)).toFixed(2)} | ${med(x.map(l => l.custo_cc || 0)).toFixed(3)} | ` +
      `${med(x.map(l => l.custo_api)).toFixed(3)} | ${Math.round(med(x.map(l => l.tok_principal)) / 1000)} mil | ${Math.round(med(x.map(l => l.tok_sub)) / 1000)} mil | ` +
      `${med(x.map(l => l.subagentes)).toFixed(1)} | ${Math.round(med(x.map(l => l.seg)))} | ${x.filter(l => l.skill).length}/${x.length} | ${x.length} |`);
  }
  const erros = L.filter(l => l.erro); if (erros.length) console.log('\nErros:', erros.map(l => `T${l.t}${l.modo}${l.rep}: ${l.erro}`).join(' | '));
}

const [cmd, t, modo, rep] = process.argv.slice(2);
if (cmd === 'preparar') preparar();
else if (cmd === 'rodar') {
  if (t === 'rep') for (const tt of LISTA) for (const m of +modo === 1 ? ['A', 'B'] : ['B', 'A']) rodarUm(tt, m, +modo);
  else if (t) rodarUm(+t, modo, +(rep || 0));
  else for (const r of [1, 2]) for (const tt of LISTA) for (const m of r === 1 ? ['A', 'B'] : ['B', 'A']) rodarUm(tt, m, r);
} else if (cmd === 'resumo') resumo();
else console.log('uso: node bench.js preparar | rodar [t modo rep] | resumo');
