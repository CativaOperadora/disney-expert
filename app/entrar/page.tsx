'use client';

import { useState } from 'react';

/**
 * Login do CRM interno (equipe Cativa).
 *
 * Compartilha o layout de duas colunas do Portal, mas sem seletor de
 * perfil: aqui o acesso é único, por senha compartilhada do painel.
 */
export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setIndo(true);
    setErro(null);
    const r = await fetch('/api/entrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (r.ok) {
      window.location.href = '/painel';
    } else {
      const d = await r.json().catch(() => ({}));
      setErro(d?.erro ?? 'E-mail ou senha incorretos.');
      setIndo(false);
    }
  }

  return (
    <div className="login-tela">
      {/* Painel de marca do CRM: só a assinatura, centralizada. O portal
          da agência mantém a versão com proposta de valor — ali é venda;
          aqui é a ferramenta interna, e quem entra já sabe o que é. */}
      <aside className="login-arte login-arte-simples" aria-hidden="true">
        <div className="login-arte-assinatura">
          <img className="login-arte-logo" src="/logo-orlando-expert-branco.png" alt="" />
          <p className="login-arte-legenda">
            Plataforma de Consultoria Orlando Expert
          </p>
        </div>
      </aside>

      <div className="login-painel">
        <form className="login-cartao" onSubmit={enviar}>
          <img
            className="login-logo-mobile"
            src="/logo-orlando-expert-azul.png"
            alt="Cativa Orlando Expert"
          />

          <h1 className="login-titulo">Painel da consultoria</h1>
          <p className="login-sub">
            Acesso restrito à equipe Cativa. É a agência que entra pelo{' '}
            <a href="/portal/entrar">Portal do Agente</a>.
          </p>

          {erro && <div className="erro-caixa">{erro}</div>}

          <div className="campo">
            <label className="rotulo" htmlFor="email">E-mail</label>
            <input
              id="email"
              className="entrada"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="campo">
            <label className="rotulo" htmlFor="senha">Senha</label>
            <input
              id="senha"
              className="entrada"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>

          <button className="botao botao-principal" type="submit" disabled={indo}>
            {indo ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
