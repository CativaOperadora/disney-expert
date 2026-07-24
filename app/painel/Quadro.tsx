'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface Cartao {
  id: string;
  protocolo: string;
  status: string;
  completude: number;
  cliente_nome: string;
  data_prevista_texto: string | null;
  total_pessoas: number | null;
  total_criancas: number | null;
  agencia_nome: string | null;
  agencia_tier: string | null;
  agente_nome: string | null;
  criado_em: string;
  parado_desde: string;
  email_falhou: boolean;
}

const COLUNAS = [
  { id: 'novo', titulo: 'Novo', nota: 'Chegou, ninguém olhou' },
  { id: 'triagem', titulo: 'Triagem', nota: 'Falta dado ou o link falhou' },
  { id: 'em_analise', titulo: 'Em análise', nota: 'Estudando o briefing' },
  { id: 'consultoria_entregue', titulo: 'Consultoria entregue', nota: 'Orientação enviada' },
  { id: 'com_agencia', titulo: 'Com a agência', nota: 'Montando a proposta' },
  { id: 'follow_up', titulo: 'Follow-up', nota: 'Aguardando retorno' },
];

const COLUNAS_FIM = [
  { id: 'ganho', titulo: 'Reserva confirmada', nota: '' },
  { id: 'perdido', titulo: 'Perdido', nota: '' },
  { id: 'duplicada', titulo: 'Duplicada', nota: '' },
];

/** Dias inteiros desde que o cartão entrou na coluna atual. */
function diasParado(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function faixaEspera(dias: number): 0 | 1 | 2 | 3 {
  if (dias < 1) return 0;
  if (dias < 3) return 1;
  if (dias < 7) return 2;
  return 3;
}

function textoEspera(dias: number) {
  if (dias < 1) return 'hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

export default function Quadro({
  cartoes: iniciais,
  encerradas,
}: {
  cartoes: Cartao[];
  encerradas: boolean;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [cartoes, setCartoes] = useState(iniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const colunas = encerradas ? COLUNAS_FIM : COLUNAS;

  async function mover(id: string, destino: string) {
    const anterior = cartoes;
    // Move na tela primeiro. Se o servidor recusar, volta.
    setCartoes((c) =>
      c.map((x) =>
        x.id === id
          ? { ...x, status: destino, parado_desde: new Date().toISOString() }
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
        {colunas.map((col) => {
          const doColuna = cartoes.filter((c) => c.status === col.id);
          const maisParado = doColuna.reduce(
            (max, c) => Math.max(max, diasParado(c.parado_desde)),
            0,
          );

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
                {maisParado >= 3 && (
                  <p className={`coluna-espera nivel-${faixaEspera(maisParado)}`}>
                    Mais parado: {textoEspera(maisParado)}
                  </p>
                )}
              </header>

              <div className="coluna-corpo">
                {doColuna.map((c) => {
                  const dias = diasParado(c.parado_desde);
                  return (
                    <article
                      key={c.id}
                      className={`ficha ${arrastando === c.id ? 'movendo' : ''}`}
                      draggable={!encerradas}
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
                      <span
                        className={`espera nivel-${faixaEspera(dias)}`}
                        title={`Parado há ${textoEspera(dias)}`}
                      />

                      <Link href={`/painel/${c.id}`} className="ficha-corpo">
                        <div className="ficha-topo">
                          <span className="ficha-protocolo">{c.protocolo}</span>
                          {c.agencia_tier === 'select' && (
                            <span className="selo">Select</span>
                          )}
                        </div>

                        <h3 className="ficha-nome">{c.cliente_nome}</h3>

                        <p className="ficha-dado">
                          {c.total_pessoas ?? '?'} pessoas
                          {c.total_criancas
                            ? `, ${c.total_criancas} criança${c.total_criancas > 1 ? 's' : ''}`
                            : ''}
                        </p>
                        {c.data_prevista_texto && (
                          <p className="ficha-dado">{c.data_prevista_texto}</p>
                        )}

                        <p className="ficha-agencia">
                          {c.agencia_nome ?? 'Agência não identificada'}
                        </p>

                        <footer className="ficha-rodape">
                          <span className={`tempo-selo nivel-${faixaEspera(dias)}`}>
                            {textoEspera(dias)}
                          </span>
                          {c.completude < 100 && (
                            <span className="aviso-selo">
                              {c.completude}% do briefing
                            </span>
                          )}
                          {c.email_falhou && (
                            <span className="aviso-selo grave">E-mail voltou</span>
                          )}
                        </footer>
                      </Link>
                    </article>
                  );
                })}

                {doColuna.length === 0 && (
                  <div className="coluna-vazia">
                    {encerradas ? 'Nada aqui' : 'Arraste um cartão para cá'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {!encerradas && (
        <p className="dica">
          Arraste os cartões entre as colunas para mudar a situação. No celular,
          abra o cartão e altere por lá.
        </p>
      )}
    </>
  );
}
