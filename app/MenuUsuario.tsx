'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Menu do próprio usuário, aberto pelo nome/avatar no cabeçalho.
 *
 * Concentra o que é "meu" — perfil, meu dashboard, meu link — tirando
 * esses itens da navegação principal, que passa a ter só o que é do
 * trabalho compartilhado (solicitações, leads, agências).
 *
 * Compartilhado pelas duas áreas: o CRM interno e o Portal passam listas
 * diferentes, mas o comportamento de abrir, fechar e navegar é o mesmo.
 *
 * Acessibilidade: fecha com Esc e com clique fora, devolve o foco ao
 * botão ao fechar por teclado, e anuncia o estado com aria-expanded.
 */

export interface ItemMenu {
  href: string;
  rotulo: string;
  descricao?: string;
  icone: React.ReactNode;
}

export default function MenuUsuario({
  nome,
  foto,
  selo,
  itens,
  sairHref,
}: {
  nome: string;
  foto: string | null;
  /** Ex.: "Admin". Some quando não faz sentido. */
  selo?: string | null;
  itens: ItemMenu[];
  sairHref: string;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const iniciais = nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  useEffect(() => {
    if (!aberto) return;

    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };

    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  return (
    <div className="menu-usuario" ref={caixa}>
      <button
        ref={botao}
        type="button"
        className={`menu-usuario-gatilho${aberto ? ' aberto' : ''}`}
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="menu"
      >
        {foto ? (
          <img className="usuario-foto" src={`/api/foto/${foto}`} alt="" />
        ) : (
          <span className="usuario-foto usuario-foto-vazia" aria-hidden="true">
            {iniciais}
          </span>
        )}
        <span className="menu-usuario-nome">{nome}</span>
        {selo && <span className="selo-admin">{selo}</span>}
        <svg
          className="menu-usuario-seta" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="menu-usuario-painel" role="menu">
          <div className="menu-usuario-topo">
            <strong>{nome}</strong>
            <span>Sua conta</span>
          </div>

          <ul className="menu-usuario-lista">
            {itens.map((i) => (
              <li key={i.href}>
                <Link href={i.href} role="menuitem" onClick={() => setAberto(false)}>
                  <span className="menu-usuario-icone" aria-hidden="true">{i.icone}</span>
                  <span>
                    <span className="menu-usuario-rot">{i.rotulo}</span>
                    {i.descricao && (
                      <span className="menu-usuario-desc">{i.descricao}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="menu-usuario-rodape">
            <Link href={sairHref} role="menuitem" prefetch={false}>
              <span className="menu-usuario-icone" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              Sair
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* Ícones dos itens, num lugar só para os dois cabeçalhos reaproveitarem. */
const svg = (d: React.ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export const ICONE_PERFIL = svg(
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </>,
);

export const ICONE_DASHBOARD = svg(
  <>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20H2" />
  </>,
);

export const ICONE_LINK = svg(
  <>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </>,
);
