'use client';

import { useMemo, useState } from 'react';
import type { Lead, FiltroLeads } from '@/lib/leads';

/**
 * Tabela de leads com seleção e exportação.
 *
 * A seleção existe para montar a lista de uma campanha específica: marca
 * quem interessa e exporta só isso. Sem nada marcado, o botão exporta
 * todos os leads do filtro atual — que é o caso mais comum.
 */

const DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const reais = (n: number) =>
  `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

export default function TabelaLeads({
  leads,
  filtros,
  admin,
}: {
  leads: Lead[];
  filtros: FiltroLeads;
  admin: boolean;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const todosMarcados = leads.length > 0 && selecionados.size === leads.length;
  const aptosSelecionados = useMemo(
    () => leads.filter((l) => selecionados.has(l.email) && l.marketing).length,
    [leads, selecionados],
  );

  function alternar(email: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(email)) novo.delete(email);
      else novo.add(email);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados(todosMarcados ? new Set() : new Set(leads.map((l) => l.email)));
  }

  async function exportar() {
    setBaixando(true);
    setErro(null);
    try {
      const r = await fetch('/api/portal/leads/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...filtros,
          emails: selecionados.size > 0 ? [...selecionados] : undefined,
        }),
      });
      if (!r.ok) throw new Error();

      // Nome do arquivo definido pelo servidor, no Content-Disposition.
      const nome =
        r.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] ??
        'leads.csv';
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro('Não foi possível gerar a planilha. Tente de novo.');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <div className="leads-barra">
        <span className="leads-contagem">
          {selecionados.size > 0
            ? `${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''}`
            : `${leads.length} contato${leads.length === 1 ? '' : 's'}`}
          {selecionados.size > 0 && (
            <span className="leads-contagem-sub">
              {' '}· {aptosSelecionados} aceita{aptosSelecionados === 1 ? '' : 'm'} campanha
            </span>
          )}
        </span>

        <div className="leads-barra-acoes">
          {selecionados.size > 0 && (
            <button
              type="button"
              className="portal-limpar"
              onClick={() => setSelecionados(new Set())}
            >
              Limpar seleção
            </button>
          )}
          <button
            type="button"
            className="botao botao-principal"
            onClick={exportar}
            disabled={baixando || leads.length === 0}
          >
            {baixando
              ? 'Gerando…'
              : selecionados.size > 0
                ? `Baixar planilha (${selecionados.size})`
                : 'Baixar planilha'}
          </button>
        </div>
      </div>

      {erro && <div className="erro-caixa">{erro}</div>}

      <div className="portal-tabela-wrap">
        <table className="portal-tabela leads-tabela">
          <thead>
            <tr>
              <th className="leads-col-check">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  aria-label="Selecionar todos"
                />
              </th>
              <th>Contato</th>
              <th>WhatsApp</th>
              <th>Cidade</th>
              {admin && <th>Agente</th>}
              <th>Situação</th>
              <th className="col-num">Pedidos</th>
              <th className="col-num">Último</th>
              <th className="col-num">Comprou</th>
              <th>Campanha</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.email}
                className={`portal-linha${selecionados.has(l.email) ? ' leads-marcada' : ''}`}
              >
                <td className="leads-col-check">
                  <input
                    type="checkbox"
                    checked={selecionados.has(l.email)}
                    onChange={() => alternar(l.email)}
                    aria-label={`Selecionar ${l.nome}`}
                  />
                </td>
                <td>
                  <span className="leads-nome">{l.nome}</span>
                  <span className="leads-email">{l.email}</span>
                </td>
                <td>{l.whatsapp ?? '—'}</td>
                <td>{l.cidade ?? '—'}</td>
                {admin && <td className="portal-agente">{l.agente_nome ?? '—'}</td>}
                <td>
                  <span className={`status-tag status-${l.ultimo_status}`}>
                    {l.ultimo_status_rotulo}
                  </span>
                </td>
                <td className="col-num">
                  {l.solicitacoes > 1 ? (
                    <span className="leads-recorrente">{l.solicitacoes}</span>
                  ) : (
                    l.solicitacoes
                  )}
                </td>
                <td className="col-num">{DATA.format(new Date(l.ultimo_em))}</td>
                <td className="col-num">
                  {l.vendas > 0 ? (
                    <span className="leads-valor">{reais(l.faturamento)}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {l.marketing ? (
                    <span className="leads-optin sim">Aceita</span>
                  ) : (
                    <span className="leads-optin nao">Não</span>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={admin ? 10 : 9} className="portal-vazio">
                  Nenhum lead encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="leads-aviso">
        <strong>Antes de disparar campanha:</strong> use apenas os contatos
        marcados como <em>Aceita</em>. O aceite obrigatório do formulário
        autoriza somente a elaboração da proposta de viagem — enviar oferta
        para quem não deu o opt-in de marketing contraria o princípio da
        finalidade da LGPD. O filtro <em>Só quem aceita campanha</em> deixa a
        planilha pronta para isso.
      </p>
    </>
  );
}
