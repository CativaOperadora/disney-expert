'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Entrar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const r = await fetch('/api/portal/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro ?? 'Não foi possível entrar.');
      }
      router.push('/portal');
      router.refresh();
    } catch (err: any) {
      setErro(err?.message ?? 'Não foi possível entrar.');
      setEntrando(false);
    }
  }

  return (
    <div className="portal-login">
      <form className="portal-login-cartao" onSubmit={enviar}>
        <div className="portal-login-marca">
          <span className="marca-nome">Orlando Expert</span>
        </div>
        <h1 className="portal-login-titulo">Portal do Agente</h1>
        <p className="portal-login-sub">
          Acompanhe as suas solicitações e vendas em um só lugar.
        </p>

        {erro && <div className="erro-caixa">{erro}</div>}

        <div className="campo">
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input
            id="email"
            className="entrada"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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

        <button className="botao botao-principal" type="submit" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="portal-login-rodape">
          Esqueceu a senha? Fale com o administrador da sua agência.
        </p>
      </form>
    </div>
  );
}
