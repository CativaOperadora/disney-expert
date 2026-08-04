'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Seletor de seguidores — múltipla escolha, pesquisável, sem digitação
 * livre.
 *
 * O campo de busca FILTRA a lista de colegas; ele nunca vira valor. Só é
 * possível adicionar clicando em alguém que veio do servidor, e o
 * servidor só devolve gente ativa da mesma agência. Digitar um e-mail
 * qualquer não faz nada.
 */

interface Pessoa {
  id: string;
  nome: string;
  email: string;
}
interface Seguidor {
  agente_id: string;
  nome: string;
  email: string;
  admin: boolean;
}

const iniciais = (nome: string) =>
  nome.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export default function Seguidores({ id }: { id: string }) {
  const [seguidores, setSeguidores] = useState<Seguidor[]>([]);
  const [candidatos, setCandidatos] = useState<Pessoa[]>([]);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  async function carregar() {
    try {
      const r = await fetch(`/api/portal/solicitacoes/${id}/seguidores`);
      if (!r.ok) return;
      const d = await r.json();
      setSeguidores(d.seguidores ?? []);
      setCandidatos(d.candidatos ?? []);
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberto(false);
        setBusca('');
      }
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return candidatos;
    return candidatos.filter(
      (c) => c.nome.toLowerCase().includes(t) || c.email.toLowerCase().includes(t),
    );
  }, [busca, candidatos]);

  async function alterar(agenteId: string, remover: boolean) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`/api/portal/solicitacoes/${id}/seguidores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agenteId, remover }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro);
      }
      setBusca('');
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível atualizar os seguidores.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="cartao-bi">
      <h3 className="cartao-bi-titulo">Seguidores</h3>
      <p className="portal-nota" style={{ marginBottom: 14 }}>
        Colegas da sua agência que acompanham esta negociação e recebem as
        notificações dela.
      </p>

      {erro && <div className="erro-caixa">{erro}</div>}

      {seguidores.length > 0 && (
        <ul className="seg-lista">
          {seguidores.map((s) => (
            <li key={s.agente_id}>
              <span className="seg-avatar" aria-hidden="true">{iniciais(s.nome)}</span>
              <span className="seg-nome">
                {s.nome}
                {s.admin && <span className="selo-admin">Admin</span>}
              </span>
              <button
                type="button"
                className="seg-remover"
                aria-label={`Remover ${s.nome}`}
                disabled={ocupado}
                onClick={() => alterar(s.agente_id, true)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="seg-seletor" ref={caixa}>
        <input
          className="entrada"
          type="text"
          placeholder="Buscar colega para adicionar…"
          value={busca}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          disabled={ocupado || candidatos.length === 0}
        />

        {aberto && (
          <ul className="seg-opcoes">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => alterar(c.id, false)} disabled={ocupado}>
                  <span className="seg-avatar" aria-hidden="true">{iniciais(c.nome)}</span>
                  <span>
                    <span className="seg-opcao-nome">{c.nome}</span>
                    <span className="seg-opcao-email">{c.email}</span>
                  </span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && (
              <li className="seg-vazio">
                {candidatos.length === 0
                  ? 'Todos os colegas já seguem este ticket.'
                  : 'Nenhum colega encontrado.'}
              </li>
            )}
          </ul>
        )}
      </div>

      {seguidores.length === 0 && (
        <p className="portal-nota" style={{ marginTop: 10 }}>
          Ninguém segue este ticket ainda.
        </p>
      )}
    </section>
  );
}
