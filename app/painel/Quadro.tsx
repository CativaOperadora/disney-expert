'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calcularSla, MOTIVOS_PERDA } from '@/lib/sla';

export interface Cartao {
  id: string;
  protocolo: string;
  status: string;
  responsavel_id: string | null;
  completude: number;
  data_prevista_texto: string | null;
  total_pessoas: number | null;
  total_criancas: number | null;
  agencia_nome: string | null;
  agencia_tier: string | null;
  agente_nome: string | null;
  criado_em: string;
  sla_horas: number;
  primeiro_atendimento_em: string | null;
  email_falhou: boolean;
}

export interface Coluna {
  chave: string;
  titulo: string;
  status: string;
  consultoraId: string | null;
  nota?: string;
}

/** Um cartão pertence a uma coluna pelo status e, na consultoria, pela consultora. */
function naColuna(c: Cartao, col: Coluna): boolean {
  if (c.status !== col.status) return false;
  if (col.consultoraId === null) return true;
  return c.responsavel_id === col.consultoraId;
}

export default function Quadro({
  cartoes: iniciais,
  colunas,
  agora,
}: {
  cartoes: Cartao[];
  colunas: Coluna[];
  agora: number;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [cartoes, setCartoes] = useState(iniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Modal de motivo da perda: guarda o cartão a mover e a coluna destino.
  const [perda, setPerda] = useState<{ id: string; col: Coluna } | null>(null);
  const [motivo, setMotivo] = useState('');

  async function mover(id: string, col: Coluna, motivoPerda?: string) {
    const anterior = cartoes;
    setCartoes((c) =>
      c.map((x) =>
        x.id === id
          ? {
              ...x,
              status: col.status,
              responsavel_id: col.consultoraId ?? x.responsavel_id,
              primeiro_atendimento_em:
                col.status !== 'nova_solicitacao' && !x.primeiro_atendimento_em
                  ? new Date().toISOString()
                  : x.primeiro_atendimento_em,
            }
          : x,
      ),
    );
    setErro(null);

    const corpo: any = { acao: 'status', status: col.status };
    if (col.consultoraId) corpo.responsavel = col.consultoraId;
    if (col.status === 'venda_perdida') corpo.motivo = motivoPerda;

    try {
      const r = await fetch(`/api/painel/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error();
      iniciarTransicao(() => router.refresh());
    } catch {
      setCartoes(anterior);
      setErro('Não foi possível mover o cartão. Tente de novo.');
    }
  }

  function aoSoltar(col: Coluna, id: string) {
    const atual = cartoes.find((c) => c.id === id);
    if (!id || !atual || naColuna(atual, col)) return;
    if (col.status === 'venda_perdida') {
      // Abre o modal obrigatório de motivo antes de concluir a movimentação.
      setMotivo('');
      setPerda({ id, col });
    } else {
      mover(id, col);
    }
  }

  return (
    <>
      {erro && <div className="faixa-erro">{erro}</div>}

      <div className="quadro">
        {colunas.map((col) => {
          const doColuna = cartoes
            .filter((c) => naColuna(c, col))
            .map((c) => ({
              ...c,
              sla: calcularSla(c.criado_em, c.sla_horas, c.primeiro_atendimento_em, agora),
            }))
            .sort((a, b) =>
              col.status === 'nova_solicitacao'
                ? a.sla.horasRestantes - b.sla.horasRestantes
                : +new Date(b.criado_em) - +new Date(a.criado_em),
            );

          const emRisco = doColuna.filter(
            (c) => c.sla.faixa === 'urgente' || c.sla.faixa === 'atrasado',
          ).length;

          return (
            <section
              key={col.chave}
              className={`coluna ${alvo === col.chave ? 'alvo' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(col.chave);
              }}
              onDragLeave={() => setAlvo((a) => (a === col.chave ? null : a))}
              onDrop={(e) => {
                e.preventDefault();
                setAlvo(null);
                aoSoltar(col, e.dataTransfer.getData('text/plain'));
              }}
            >
              <header className="coluna-topo">
                <div className="coluna-linha">
                  <h2 className="coluna-titulo">{col.titulo}</h2>
                  <span className="coluna-conta">{doColuna.length}</span>
                </div>
                {col.nota && <p className="coluna-nota">{col.nota}</p>}
                {emRisco > 0 && <p className="coluna-risco">{emRisco} em risco</p>}
              </header>

              <div className="coluna-corpo">
                {doColuna.map((c) => (
                  <article
                    key={c.id}
                    className={`ficha ${arrastando === c.id ? 'movendo' : ''} ${
                      c.sla.faixa === 'atrasado' ? 'atrasada' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', c.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setArrastando(c.id);
                    }}
                    onDragEnd={() => {
                      setArrastando(null);
                      setAlvo(null);
                    }}
                  >
                    <Link href={`/painel/${c.id}`} className="ficha-corpo">
                      <div className="ficha-topo">
                        <span className="ficha-protocolo">{c.protocolo}</span>
                        {c.agencia_tier === 'select' && (
                          <span className="selo">Agência Select</span>
                        )}
                      </div>

                      <h3 className="ficha-nome">
                        {c.agente_nome ?? 'Agente não identificado'}
                      </h3>
                      <p className="ficha-agencia">
                        {c.agencia_nome ?? 'Agência não identificada'}
                      </p>

                      <p className="ficha-dado">
                        {c.total_pessoas ?? '?'} pessoas
                        {c.total_criancas
                          ? `, ${c.total_criancas} criança${c.total_criancas > 1 ? 's' : ''}`
                          : ''}
                        {c.data_prevista_texto ? ` · ${c.data_prevista_texto}` : ''}
                      </p>

                      <div className={`sla sla-${c.sla.faixa}`}>
                        <div className="sla-barra">
                          <span style={{ width: `${c.sla.consumido * 100}%` }} />
                        </div>
                        <span className="sla-texto">{c.sla.rotulo}</span>
                      </div>

                      {c.email_falhou && (
                        <footer className="ficha-rodape">
                          <span className="aviso-selo grave">E-mail não entregue</span>
                        </footer>
                      )}
                    </Link>
                  </article>
                ))}

                {doColuna.length === 0 && (
                  <div className="coluna-vazia">Arraste um cartão para cá</div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal obrigatório de motivo da perda */}
      {perda && (
        <div className="modal-fundo" onClick={() => setPerda(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Motivo da perda</h3>
            <p className="modal-texto">
              Selecione o motivo para mover esta solicitação para <strong>Venda perdida</strong>.
              É obrigatório.
            </p>
            <select
              className="entrada"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="">Selecione um motivo…</option>
              {MOTIVOS_PERDA.map(([v, r]) => (
                <option key={v} value={v}>{r}</option>
              ))}
            </select>
            <div className="modal-acoes">
              <button className="botao botao-voltar" onClick={() => setPerda(null)}>
                Cancelar
              </button>
              <button
                className="botao botao-principal"
                disabled={!motivo}
                onClick={() => {
                  mover(perda.id, perda.col, motivo);
                  setPerda(null);
                }}
              >
                Confirmar perda
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
