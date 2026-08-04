'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calcularSla, MOTIVOS_PERDA } from '@/lib/sla';
import { MAX_ARQUIVOS, LIMITE_MB, ACCEPT_ARQUIVO } from '@/lib/anexos-limites';

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
  const [descricao, setDescricao] = useState('');
  // Os arquivos ficam aqui e só sobem na confirmação. Enviar antes deixaria
  // imagens órfãs no volume toda vez que alguém cancelasse o modal.
  const [imagens, setImagens] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  /** Sobe as imagens escolhidas. Devolve erro na primeira que falhar. */
  async function enviarImagens(id: string, arquivos: File[]): Promise<string | null> {
    for (const arquivo of arquivos) {
      const dados = new FormData();
      dados.append('arquivo', arquivo);
      const r = await fetch(`/api/painel/${id}/anexos`, { method: 'POST', body: dados });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return d?.erro ?? `Não foi possível enviar "${arquivo.name}".`;
      }
    }
    return null;
  }

  async function mover(
    id: string,
    col: Coluna,
    motivoPerda?: string,
    descricaoPerda?: string,
  ) {
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
    if (col.status === 'venda_perdida') {
      corpo.motivo = motivoPerda;
      corpo.descricao = descricaoPerda ?? '';
    }

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
      setDescricao('');
      setImagens([]);
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

                      {/* Acompanha o cartão em qualquer visualização, para a
                          perda não passar despercebida fora da coluna. */}
                      {c.status === 'venda_perdida' && (
                        <span className="tag-perdida">Venda Perdida</span>
                      )}

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
        <div className="modal-fundo" onClick={() => !enviando && setPerda(null)}>
          <div className="modal modal-perda" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-titulo">Registrar venda perdida</h3>
            <p className="modal-texto">
              O motivo é obrigatório. A descrição e as imagens são opcionais e
              ficam no histórico da solicitação.
            </p>

            <div className="campo">
              <label className="rotulo" htmlFor="motivo-perda">Motivo da perda</label>
              <select
                id="motivo-perda"
                className="entrada"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              >
                <option value="">Selecione um motivo…</option>
                {MOTIVOS_PERDA.map(([v, r]) => (
                  <option key={v} value={v}>{r}</option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label className="rotulo" htmlFor="descricao-perda">
                Descrição <span className="rotulo-opcional">opcional</span>
              </label>
              <textarea
                id="descricao-perda"
                className="entrada"
                rows={3}
                maxLength={2000}
                placeholder="Detalhe o que aconteceu, se ajudar a entender a perda."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="campo">
              <label className="rotulo" htmlFor="imagens-perda">
                Imagens <span className="rotulo-opcional">opcional</span>
              </label>
              <span className="ajuda">
                Até {MAX_ARQUIVOS} imagens, {LIMITE_MB} MB cada. JPG, PNG, GIF ou WEBP.
              </span>
              <input
                id="imagens-perda"
                className="entrada entrada-arquivo"
                type="file"
                accept={ACCEPT_ARQUIVO}
                multiple
                onChange={(e) => {
                  const novos = Array.from(e.target.files ?? []);
                  setImagens((atual) => [...atual, ...novos].slice(0, MAX_ARQUIVOS));
                  e.target.value = '';
                }}
              />

              {imagens.length > 0 && (
                <ul className="perda-imagens">
                  {imagens.map((img, i) => (
                    <li key={`${img.name}-${i}`}>
                      {/* Prévia local: o arquivo ainda não subiu. */}
                      <img src={URL.createObjectURL(img)} alt="" />
                      <span className="perda-imagem-nome">{img.name}</span>
                      <button
                        type="button"
                        className="perda-imagem-remover"
                        aria-label={`Remover ${img.name}`}
                        onClick={() => setImagens((a) => a.filter((_, k) => k !== i))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="modal-acoes">
              <button
                className="botao botao-voltar"
                disabled={enviando}
                onClick={() => setPerda(null)}
              >
                Cancelar
              </button>
              <button
                className="botao botao-principal"
                disabled={!motivo || enviando}
                onClick={async () => {
                  const alvo = perda;
                  setEnviando(true);
                  setErro(null);
                  // As imagens sobem primeiro: se alguma falhar, o cartão
                  // não se move e o especialista corrige sem perder o texto.
                  const falha = imagens.length
                    ? await enviarImagens(alvo.id, imagens)
                    : null;
                  setEnviando(false);
                  if (falha) {
                    setErro(falha);
                    return;
                  }
                  setPerda(null);
                  mover(alvo.id, alvo.col, motivo, descricao);
                }}
              >
                {enviando ? 'Enviando…' : 'Confirmar perda'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
