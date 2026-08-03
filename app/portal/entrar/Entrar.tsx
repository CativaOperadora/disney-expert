'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Login do Portal, com escolha explícita do perfil.
 *
 * O perfil escolhido NÃO concede nada: quem decide se a conta é admin
 * continua sendo o banco, em portal-auth.ts. Aqui ele serve para duas
 * coisas — deixar claro em qual acesso a pessoa está entrando, e detectar
 * quando ela errou a aba, mostrando uma mensagem útil em vez de largá-la
 * numa tela que não é a esperada.
 */

type Perfil = 'admin' | 'agente';

const PERFIS: {
  id: Perfil;
  rotulo: string;
  sub: string;
  dica: string;
  icone: React.ReactNode;
}[] = [
  {
    id: 'admin',
    rotulo: 'Administrador',
    sub: 'Gestão da agência',
    dica:
      'Acesso à agência inteira: solicitações de todos os agentes, dashboard consolidado, base de leads e gestão de usuários.',
    icone: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v5.5c0 4.3-3 8.2-7 9.5-4-1.3-7-5.2-7-9.5V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'agente',
    rotulo: 'Agente de Viagens',
    sub: 'Meus atendimentos',
    dica:
      'Acesso ao que você captou: suas solicitações, seus leads e o seu link pessoal de captação.',
    icone: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
      </svg>
    ),
  },
];

const VANTAGENS = [
  'Kanban das solicitações em tempo real',
  'Dashboard de faturamento e conversão',
  'Base de leads pronta para exportar',
];

export default function Entrar() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil>('agente');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = PERFIS.find((p) => p.id === perfil)!;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    try {
      const r = await fetch('/api/portal/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha, perfil }),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        // Credenciais certas, aba errada: corrige a seleção para a pessoa
        // só precisar confirmar, em vez de adivinhar o que houve.
        if (r.status === 409 && (d?.perfilCorreto === 'admin' || d?.perfilCorreto === 'agente')) {
          setPerfil(d.perfilCorreto);
        }
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
    <div className="login-tela">
      <aside className="login-arte" aria-hidden="true">
        <img
          className="login-arte-logo"
          src="/logo-orlando-expert-branco.png"
          alt=""
        />

        <div className="login-arte-centro">
          <h2 className="login-arte-frase">
            Do primeiro contato à <em>venda fechada</em>, em um só lugar.
          </h2>
          <p className="login-arte-texto">
            O portal da sua agência para acompanhar cada solicitação enviada
            à consultoria Orlando Expert.
          </p>
        </div>

        <ul className="login-arte-lista">
          {VANTAGENS.map((v) => (
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
          {/* Só aparece no celular, onde o painel de marca fica oculto. */}
          <img
            className="login-logo-mobile"
            src="/logo-orlando-expert-azul.png"
            alt="Cativa Orlando Expert"
          />

          <h1 className="login-titulo">Portal do Agente</h1>
          <p className="login-sub">Escolha o seu tipo de acesso para continuar.</p>

          <fieldset className="login-perfis">
            <legend className="sr-only">Tipo de acesso</legend>
            {PERFIS.map((p) => (
              <label className="login-perfil" key={p.id}>
                <input
                  type="radio"
                  name="perfil"
                  value={p.id}
                  checked={perfil === p.id}
                  onChange={() => {
                    setPerfil(p.id);
                    setErro(null);
                  }}
                />
                <span className="login-perfil-face">
                  <span className="login-perfil-icone">{p.icone}</span>
                  <span>
                    <span className="login-perfil-rot">{p.rotulo}</span>
                    <span className="login-perfil-sub">{p.sub}</span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="login-dica">{atual.dica}</p>

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
            {entrando ? 'Entrando…' : `Entrar como ${atual.rotulo}`}
          </button>

          <p className="login-rodape">
            Esqueceu a senha? Fale com o administrador da sua agência.
          </p>
        </form>
      </div>
    </div>
  );
}
