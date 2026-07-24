'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { STATUS, calcularSla } from '@/lib/sla';

export interface Cartao {
  id: string;
  protocolo: string;
  status: string;
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

export default function Quadro({ cartoes: iniciais }: { cartoes: Cartao[] }) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [cartoes, setCartoes] = useState(iniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mover(id: string, destino: string) {
    const anterior = cartoes;
    setCartoes((c) =>
      c.map((x) =>
        x.id === id
          ? {
              ...x,
              status: destino,
              primeiro_atendimento_em:
                destino !== 'nova_solicitacao' && !x.primeiro_atendimento_em
                  ? new Date().toISOString()
                  : x.primeiro_atendimento_em,
            }
          : x,
      ),
    );
    setErro(null);

    try {
      const r = await fetch(`/api/painel/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'status', status: destino }),
      });
      if (!r.ok) throw new Error();
      iniciarTransicao(() => router.refresh());
    } catch {
      setCartoes(anterior);
      setErro('Não foi possível mover o cartão. Tente de novo.');
    }
  }

  return (
    <>
      {erro && <div className="faixa-erro">{erro}</div>}

      <div className="quadro">
        {STATUS.map((col) => {
          const doColuna = cartoes
            .filter((c) => c.status === col.id)
            .map((c) => ({
              ...c,
              sla: calcularSla(c.criado_em, c.sla_horas, c.primeiro_atendimento_em),
            }))
            // Na entrada, quem vence antes aparece primeiro. Nas demais,
            // o mais recente no topo.
            .sort((a, b) =>
              col.id === 'nova_solicitacao'
                ? a.sla.horasRestantes - b.sla.horasRestantes
                : +new Date(b.criado_em) - +new Date(a.criado_em),
            );

          const emRisco = doColuna.filter(
            (c) => c.sla.faixa === 'urgente' || c.sla.faixa === 'atrasado',
          ).length;

          return (
            <section
              key={col.id}
              className={`coluna ${alvo === col.id ? 'alvo' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(col.id);
              }}
              onDragLeave={() => setAlvo((a) => (a === col.id ? null : a))}
              onDrop={(e) => {
                e.preventDefault();
                setAlvo(null);
                const id = e.dataTransfer.getData('text/plain');
                const atual = cartoes.find((c) => c.id === id);
                if (id && atual && atual.status !== col.id) mover(id, col.id);
              }}
            >
              <header className="coluna-topo">
                <div className="coluna-linha">
                  <h2 className="coluna-titulo">{col.titulo}</h2>
                  <span className="coluna-conta">{doColuna.length}</span>
                </div>
                {col.nota && <p className="coluna-nota">{col.nota}</p>}
                {emRisco > 0 && (
                  <p className="coluna-risco">
                    {emRisco} {emRisco === 1 ? 'em risco' : 'em risco'}
                  </p>
                )}
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
                          <span className="selo">Select</span>
                        )}
                      </div>

                      {/* Quem importa para a Juliana é o agente. O nome do
                          cliente final aparece só ao abrir o cartão. */}
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

                      {(c.completude < 100 || c.email_falhou) && (
                        <footer className="ficha-rodape">
                          {c.email_falhou && (
                            <span className="aviso-selo grave">E-mail não entregue</span>
                          )}
                          {c.completude < 100 && (
                            <span className="aviso-selo">
                              {c.completude}% do briefing
                            </span>
                          )}
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

      <p className="dica">
        Arraste os cartões entre as colunas para mudar a situação. O prazo de
        atendimento é de 24 horas para agências Select e 48 horas para as
        demais, contadas a partir da chegada da solicitação.
      </p>
    </>
  );
}
