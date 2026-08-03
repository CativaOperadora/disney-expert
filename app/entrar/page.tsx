'use client';

import { useState } from 'react';

/**
 * Login do CRM interno (equipe Cativa).
 *
 * Compartilha o layout de duas colunas do Portal, mas sem seletor de
 * perfil: aqui o acesso é único, por senha compartilhada do painel.
 */
export default function Entrar() {
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
      body: JSON.stringify({ senha }),
    });
    if (r.ok) {
      window.location.href = '/painel';
    } else {
      setErro('Senha incorreta.');
      setIndo(false);
    }
  }

  return (
    <div className="login-tela">
      <aside className="login-arte" aria-hidden="true">
        <img className="login-arte-logo" src="/logo-orlando-expert-branco.png" alt="" />

        <div className="login-arte-centro">
          <h2 className="login-arte-frase">
            A consultoria <em>Orlando Expert</em>, do briefing ao fechamento.
          </h2>
          <p className="login-arte-texto">
            Fila de atendimento, Kanban por consultora e indicadores da
            operação inteira.
          </p>
        </div>

        <ul className="login-arte-lista">
          {[
            'Fila priorizada por SLA',
            'Kanban por consultora',
            'BI de vendas e faturamento',
          ].map((v) => (
            <li key={v}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {v}
            </li>
          ))}
        </ul>
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
            <label className="rotulo" htmlFor="senha">Senha</label>
            <input
              id="senha"
              className="entrada"
              type="password"
              autoComplete="current-password"
              autoFocus
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
