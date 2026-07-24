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
    <main className="pagina" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1 className="display passo-titulo">Consultoria Disney</h1>
      <p className="passo-descricao">Acesso da equipe Cativa.</p>

      {erro && <div className="erro-caixa">{erro}</div>}

      <form onSubmit={enviar}>
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
        <button className="botao botao-principal" style={{ width: '100%' }} disabled={indo}>
          {indo ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
