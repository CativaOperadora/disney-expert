'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STATUS } from '@/lib/sla';
import type { LinhaSolicitacao } from '@/lib/portal';
import Comemoracao from './Comemoracao';

/**
 * Kanban do Portal — pipeline PRÓPRIO da agência.
 *
 * As colunas são as mesmas do CRM interno, mas o estado é outro registro:
 * o card lado='agencia'. Mover aqui não altera nada no quadro da
 * consultoria, e vice-versa. Cada lado controla o seu.
 *
 * NÃO existe modal de motivo da perda. O agente arrasta para "Venda
 * perdida" e a movimentação conclui — o registro de motivo é exclusivo da
 * consultoria.
 *
 * Quem pode arrastar: o agente move os cards que captou; o admin, os de
 * toda a agência. A regra vale de verdade no servidor (moverCardAgencia);
 * aqui ela apenas evita oferecer o gesto a quem receberia 404.
 */

const DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});
const reais = (v: string | null) =>
  v == null
    ? '—'
    : `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

export default function PortalKanban({
  linhas,
  admin,
  agenteId,
  celebracao,
}: {
  linhas: LinhaSolicitacao[];
  admin: boolean;
  agenteId: string;
  celebracao: boolean;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [cards, setCards] = useState(linhas);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [festa, setFesta] = useState(false);

  const podeMover = (c: LinhaSolicitacao) => admin || c.agente_id === agenteId;

  async function mover(id: string, status: string) {
    const anterior = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    setErro(null);
    try {
      const r = await fetch(`/api/portal/solicitacoes/${id}/mover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
      // Comemora só quando a venda fecha de verdade, e só se a pessoa
      // quiser: a preferência vem da sessão, não de um padrão fixo.
      if (status === 'venda_finalizada' && celebracao) setFesta(true);
      iniciarTransicao(() => router.refresh());
    } catch {
      setCards(anterior);
      setErro('Não foi possível mover o card. Tente de novo.');
    }
  }

  return (
    <div className="portal-kanban">
      <Comemoracao ligada={festa} aoTerminar={() => setFesta(false)} />
      {erro && <div className="erro-caixa">{erro}</div>}

      <div className="pk-quadro">
        {STATUS.map((col) => {
          const doColuna = cards
            .filter((l) => l.status === col.id)
            .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em));

          return (
            <section
              className={`pk-coluna ${alvo === col.id ? 'alvo' : ''}`}
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(col.id);
              }}
              onDragLeave={() => setAlvo((a) => (a === col.id ? null : a))}
              onDrop={(e) => {
                e.preventDefault();
                setAlvo(null);
                const id = e.dataTransfer.getData('text/plain');
                const card = cards.find((c) => c.id === id);
                if (card && card.status !== col.id && podeMover(card)) {
                  mover(id, col.id);
                }
              }}
            >
              <header className="pk-coluna-topo">
                <span className={`pk-ponto status-ponto-${col.id}`} />
                <h2 className="pk-coluna-titulo">{col.titulo}</h2>
                <span className="pk-coluna-conta">{doColuna.length}</span>
              </header>

              <div className="pk-coluna-corpo">
                {doColuna.map((c) => (
                  <Link
                    href={`/portal/${c.id}`}
                    key={c.id}
                    draggable={podeMover(c)}
                    onDragStart={(e) => {
                      if (!podeMover(c)) return;
                      e.dataTransfer.setData('text/plain', c.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setAlvo(null);
                    }}
                    className={`pk-card status-borda-${c.status}${
                      arrastando === c.id ? ' movendo' : ''
                    }${podeMover(c) ? '' : ' pk-card-fixo'}`}
                  >
                    <div className="pk-card-topo">
                      <span className="pk-protocolo">{c.protocolo}</span>
                      {admin && c.agente_nome && (
                        <span className="pk-agente">{c.agente_nome}</span>
                      )}
                    </div>
                    {c.status === 'venda_perdida' && (
                      <span className="tag-perdida">Venda Perdida</span>
                    )}
                    <h3 className="pk-nome">{c.cliente_nome}</h3>
                    <p className="pk-linha">
                      Orlando{c.data_prevista_texto ? ` · ${c.data_prevista_texto}` : ''}
                    </p>
                    <p className="pk-linha pk-consultora">
                      Consultora: {c.consultora_nome ?? 'a definir'}
                    </p>
                    <div className="pk-rodape">
                      <span className="pk-quando">
                        {DATA.format(new Date(c.criado_em))}
                      </span>
                      {c.valor_total_venda != null && (
                        <span className="pk-valor">{reais(c.valor_total_venda)}</span>
                      )}
                    </div>
                  </Link>
                ))}
                {doColuna.length === 0 && <div className="pk-vazio">Nenhuma</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
