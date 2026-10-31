#!/usr/bin/env python3
"""Modelo de custo da skill delega-haiku: o principal (Opus 5.5) faz direto ou delega.

Precos em US$ por milhao de tokens, tirados de
https://platform.claude.com/docs/en/about-claude/pricing em 31/10/2026.
Rode `python3 calc_economia.py`. Para testar seus numeros, edite PREMISSAS e CENARIOS.
"""

# (entrada, escrita de cache de 5 min, leitura de cache, saida)
PRECO = {
    "opus": (4.00, 5.00, 0.20, 20.00),
    "sonnet": (2.00, 2.50, 0.10, 10.00),
    "haiku": (0.10, 0.125, 0.01, 0.50),  # prompt de ate 100 mil tokens
    "haiku_longo": (0.50, 0.625, 0.05, 2.50),  # prompt acima de 100 mil tokens
}

PREMISSAS = {
    "C": 60_000,  # contexto que o principal rele a cada turno (sistema, ferramentas, conversa)
    "S": 50_000,  # contexto de partida de um subagente
    "K": 20,  # turnos que o principal ainda roda depois; o que entrou no contexto e relido em cada um
    "B": 400,  # briefing por subagente (saida do principal)
    "c": 80,  # saida de uma chamada de ferramenta
}

# M: tokens de material lido | t: chamadas de ferramenta | n: subagentes em paralelo
# E_direto: texto que o principal escreveria | E_sub: texto que cada subagente escreve
# I: o que volta ao principal (relatorios) | rev, v: material e chamadas da revisao do principal
CENARIOS = [
    dict(nome="5 titulos de anuncio", M=0, t=0, n=1, modelo="haiku",
         E_direto=150, E_sub=150, I=150, rev=0, v=0),
    dict(nome="60 variacoes de anuncio, com checagem de tamanho", M=300, t=2, n=1, modelo="haiku",
         E_direto=1_800, E_sub=3_600, I=1_900, rev=0, v=0),
    dict(nome="Metricas de 3 contas de anuncio (30 mil tokens cada)", M=90_000, t=9, n=3, modelo="haiku",
         E_direto=0, E_sub=600, I=1_800, rev=0, v=0),
    dict(nome="Pesquisa web lendo 8 paginas, 1 subagente", M=64_000, t=12, n=1, modelo="haiku",
         E_direto=0, E_sub=300, I=300, rev=0, v=0),
    dict(nome="Pesquisa web lendo 8 paginas, 2 subagentes", M=64_000, t=12, n=2, modelo="haiku",
         E_direto=0, E_sub=300, I=600, rev=0, v=0),
    dict(nome="Ler 12 arquivos de codigo e responder", M=48_000, t=12, n=1, modelo="haiku",
         E_direto=0, E_sub=300, I=300, rev=0, v=0),
    dict(nome="Implementar modulo com teste (Sonnet)", M=20_000, t=10, n=1, modelo="sonnet",
         E_direto=6_000, E_sub=6_200, I=200, rev=6_500, v=2),
]


def agente(modelo, base, base_em_cache, chegadas, saidas):
    """Uma requisicao por item: rele o contexto em cache, grava o que chegou e escreve a saida.
    Devolve (custo em US$, tokens processados, contexto final)."""
    custo = tokens = 0.0
    lido, novo = (base, 0) if base_em_cache else (0, base)
    for chega, saida in zip(chegadas, saidas):
        novo += chega
        prompt = lido + novo
        tabela = "haiku_longo" if modelo == "haiku" and prompt > 100_000 else modelo
        _, escrita, leitura, preco_saida = PRECO[tabela]
        custo += lido * leitura + novo * escrita + saida * preco_saida
        tokens += prompt + saida
        lido, novo = prompt, saida
    return custo / 1e6, tokens, lido + novo


def permanencia(fica):
    """O que entrou no contexto do principal e relido nos K turnos seguintes."""
    return PREMISSAS["K"] * fica * PRECO["opus"][2] / 1e6, PREMISSAS["K"] * fica


def direto(s):
    p, t = PREMISSAS, s["t"]
    chegadas = [0] + [s["M"] / t] * t if t else [0]
    saidas = [p["c"]] * t + [s["E_direto"]]
    custo, tokens, ctx = agente("opus", p["C"], True, chegadas, saidas)
    extra_custo, extra_tokens = permanencia(ctx - p["C"])
    custo += extra_custo + s["E_direto"] * PRECO["opus"][1] / 1e6
    return dict(custo=custo, tok_principal=tokens + extra_tokens, tok_sub=0, turnos=t + 1)


def subagente(s):
    p, n = PREMISSAS, s["n"]
    t = s["t"] // n
    chegadas = [0] + [s["M"] / n / t] * t if t else [0]
    saidas = [p["c"]] * t + [s["E_sub"]]
    return agente(s["modelo"], p["S"] + p["B"], False, chegadas, saidas), t


def delegado(s):
    p, n, v = PREMISSAS, s["n"], s["v"]
    (sub_custo, sub_tokens, _), t = subagente(s)
    # despacho (escreve os briefings), integracao (recebe relatorios) e v chamadas de revisao
    chegadas = [0, s["I"]] + [s["rev"] / v] * v if v else [0, s["I"]]
    saidas = [n * p["B"]] + [p["c"]] * v + [0]
    custo, tokens, ctx = agente("opus", p["C"], True, chegadas, saidas)
    extra_custo, extra_tokens = permanencia(ctx - p["C"])
    return dict(custo=custo + extra_custo + n * sub_custo, tok_principal=tokens + extra_tokens,
                tok_sub=n * sub_tokens, turnos=(v + 2) + (t + 1))


def correcao(s):
    """Custo extra de uma rodada de CORRIGIR em um subagente: o principal manda 150 tokens,
    o subagente rele o proprio contexto (em cache) e devolve 200."""
    p = PREMISSAS
    (_, _, ctx_sub), _ = subagente(s)
    sub, _, _ = agente(s["modelo"], ctx_sub, True, [150], [200])
    pri, _, _ = agente("opus", p["C"], True, [0, 200], [150, 0])
    return sub + pri + permanencia(350)[0]


def equilibrio(t):
    """Menor volume de material (tokens) a partir do qual delegar a 1 Haiku sai mais barato."""
    for M in range(0, 200_001, 250):
        s = dict(M=M, t=t, n=1, modelo="haiku", E_direto=0, E_sub=300, I=300, rev=0, v=0)
        if delegado(s)["custo"] <= direto(s)["custo"]:
            return M
    return None


def com(alteracoes, funcao, *args):
    """Roda funcao com PREMISSAS alteradas e depois restaura."""
    original = dict(PREMISSAS)
    PREMISSAS.update(alteracoes)
    try:
        return funcao(*args)
    finally:
        PREMISSAS.clear()
        PREMISSAS.update(original)


VARIANTES = {
    "Base (C=60 mil, K=20, S=50 mil)": {},
    "Sem permanencia (K=0)": {"K": 0},
    "Pessimista (C=20 mil, K=0, S=100 mil)": {"C": 20_000, "K": 0, "S": 100_000},
}


def usd(x):
    return f"US$ {x:.3f}".replace(".", ",")


def mil(x):
    return f"{x / 1000:,.0f} mil".replace(",", ".")


if __name__ == "__main__":
    # Verificacao: o modelo reproduz a medicao real (subagente com 1 chamada ~ 100 mil tokens)
    _, tok, _ = agente("haiku", PREMISSAS["S"] + PREMISSAS["B"], False, [0, 200], [80, 300])
    assert 95_000 <= tok <= 105_000, tok
    assert delegado(CENARIOS[0])["custo"] > direto(CENARIOS[0])["custo"]  # tarefa pequena: direto

    print("| Cenario | Custo direto | Custo delegado | Economia | Tokens no principal (direto -> delegado) "
          "| Tokens nos subagentes | Turnos em serie (direto -> delegado) |")
    print("|---|---|---|---|---|---|---|")
    for s in CENARIOS:
        d, g = direto(s), delegado(s)
        eco = 1 - g["custo"] / d["custo"]
        print(f"| {s['nome']} | {usd(d['custo'])} | {usd(g['custo'])} | {eco:+.0%} "
              f"| {mil(d['tok_principal'])} -> {mil(g['tok_principal'])} | {mil(g['tok_sub'])} "
              f"| {d['turnos']} -> {g['turnos']} |")

    print("\nEconomia de custo por conjunto de premissas")
    print("| Cenario | " + " | ".join(VARIANTES) + " |")
    print("|---|" + "---|" * len(VARIANTES))
    for s in CENARIOS:
        ecos = [com(alt, lambda: 1 - delegado(s)["custo"] / direto(s)["custo"]) for alt in VARIANTES.values()]
        print(f"| {s['nome']} | " + " | ".join(f"{e:+.0%}" for e in ecos) + " |")

    s = CENARIOS[2]
    d, g, corr = direto(s), delegado(s), correcao(s)
    uma = direto(dict(s, M=s["M"] / s["n"], t=s["t"] // s["n"]))["custo"]
    pior_um = g["custo"] + corr + uma
    pior_todos = g["custo"] + s["n"] * corr + d["custo"]
    print(f"\nCorrecao (3 contas): uma rodada de CORRIGIR custa {usd(corr)}. "
          f"Um subagente falha duas vezes e o principal assume: {usd(pior_um)} ({pior_um / d['custo']:.0%} do direto). "
          f"Os tres falham: {usd(pior_todos)} ({pior_todos / d['custo']:.0%} do direto).")

    print("\nEquilibrio: material minimo para delegar a 1 Haiku sair mais barato")
    print("| Chamadas de ferramenta | " + " | ".join(VARIANTES) + " |")
    print("|---|" + "---|" * len(VARIANTES))
    for t in (1, 2, 3, 8):
        linha = [com(alt, equilibrio, t) for alt in VARIANTES.values()]
        print(f"| {t} | " + " | ".join("ja compensa" if m == 0 else "acima de 200 mil" if m is None else f"{mil(m)} tokens" for m in linha) + " |")
