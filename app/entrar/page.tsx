'use client';

import { useState } from 'react';

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
    <div className="portal-login">
      <form className="portal-login-cartao" onSubmit={enviar}>
        <div className="portal-login-marca">
          <span className="marca-nome">Orlando Expert</span>
        </div>
        <h1 className="portal-login-titulo">Painel da consultoria</h1>
        <p className="portal-login-sub">Acesso da equipe Cativa.</p>

        {erro && <div className="erro-caixa">{erro}</div>}

        <div className="campo">
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="entrada"
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <button className="botao botao-principal" type="submit" disabled={indo}>
          {indo ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
