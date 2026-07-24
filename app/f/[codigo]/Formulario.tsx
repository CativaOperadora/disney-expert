'use client';

import { useState } from 'react';
import {
  PASSOS,
  perguntasDoPasso,
  perguntaVisivel,
  somarPessoas,
  type Pergunta,
} from '@/lib/perguntas';

type Respostas = Record<string, any>;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const HOJE = new Date();
const ANO_ATUAL = HOJE.getFullYear();
const MES_ATUAL = HOJE.getMonth() + 1;

const ANOS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2, ANO_ATUAL + 3];

/** No ano corrente, só meses a partir do próximo. Ninguém viaja para trás. */
function mesesDisponiveis(ano: number) {
  const primeiro = ano === ANO_ATUAL ? MES_ATUAL + 1 : 1;
  return MESES.map((nome, i) => ({ nome, numero: i + 1 })).filter(
    (m) => m.numero >= primeiro,
  );
}

function mascararTelefone(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validar(p: Pergunta, valor: any): string | null {
  const vazio =
    valor === undefined ||
    valor === null ||
    valor === '' ||
    (Array.isArray(valor) && valor.length === 0) ||
    (p.tipo === 'aceite' && valor !== true);

  if (vazio) {
    if (!p.obrigatoria) return null;
    if (p.tipo === 'aceite') return 'Precisamos da sua autorização para seguir.';
    if (p.tipo === 'multipla') return 'Escolha ao menos uma opção.';
    if (p.tipo === 'escolha') return 'Escolha uma opção.';
    return 'Este campo é necessário.';
  }

  if (p.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
    return 'Confira o endereço de e-mail.';
  }
  if (p.tipo === 'telefone' && String(valor).replace(/\D/g, '').length < 10) {
    return 'Informe o número com DDD.';
  }
  if (p.tipo === 'numero') {
    const n = Number(valor);
    if (!Number.isFinite(n)) return 'Informe um número.';
    if (p.min !== undefined && n < p.min) return `O mínimo é ${p.min}.`;
    if (p.max !== undefined && n > p.max) return `O máximo é ${p.max}.`;
  }
  if (p.tipo === 'mes_ano') {
    if (!/^\d{4}-\d{2}$/.test(valor)) return 'Escolha o mês e o ano.';
    const [a, m] = String(valor).split('-').map(Number);
    if (a * 12 + m <= ANO_ATUAL * 12 + MES_ATUAL) {
      return 'Escolha um período a partir do mês que vem.';
    }
  }
  return null;
}

export default function Formulario({
  codigo,
  agenteNome,
  agenciaNome,
}: {
  codigo: string;
  agenteNome: string;
  agenciaNome: string;
}) {
  const [passo, setPasso] = useState(1);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const ultimo = PASSOS.length;

  const definir = (id: string, valor: any) => {
    setRespostas((r) => ({ ...r, [id]: valor }));
    setErros((e) => {
      if (!e[id]) return e;
      const novo = { ...e };
      delete novo[id];
      return novo;
    });
  };

  const visiveis = perguntasDoPasso(passo).filter((p) =>
    perguntaVisivel(p, respostas),
  );

  function conferirPasso() {
    const novos: Record<string, string> = {};
    for (const p of visiveis) {
      const erro = validar(p, respostas[p.id]);
      if (erro) novos[p.id] = erro;
    }
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  }

  function avancar() {
    if (!conferirPasso()) return;
    setPasso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function voltar() {
    setErros({});
    setPasso((p) => p - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function enviar() {
    if (!conferirPasso()) return;
    setEnviando(true);
    setFalha(null);
    try {
      const resposta = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, respostas }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.erro ?? 'Falha no envio.');
      setProtocolo(dados.protocolo);
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setFalha(
        'Não conseguimos enviar agora. Confira sua conexão e tente de novo. Suas respostas continuam preenchidas.',
      );
    } finally {
      setEnviando(false);
    }
  }

  // ------------------------------------------------------------------ fim
  if (protocolo) {
    return (
      <div className="fim">
        <div className="fim-selo" />
        <h1 className="display fim-titulo">Recebemos suas respostas</h1>
        <p className="fim-texto">
          {agenteNome}, da {agenciaNome}, já foi avisado e vai entrar em
          contato com você para dar sequência ao planejamento.
        </p>
        <div className="protocolo">{protocolo}</div>
      </div>
    );
  }

  const info = PASSOS[passo - 1];

  return (
    <>
      {passo === 1 && (
        <div className="convite">
          <div className="convite-rotulo">Você foi convidado por</div>
          <div className="convite-nome">
            {agenteNome} · {agenciaNome}
          </div>
        </div>
      )}

      <nav className="roteiro" aria-label={`Passo ${passo} de ${ultimo}`}>
        {PASSOS.map((s) => (
          <div
            key={s.numero}
            className={`parada ${
              s.numero < passo ? 'feita' : s.numero === passo ? 'atual' : ''
            }`}
          >
            <div className="ponto" />
            <div className="parada-nome">{s.curto}</div>
          </div>
        ))}
      </nav>

      <h1 className="display passo-titulo">{info.titulo}</h1>
      <p className="passo-descricao">{info.descricao}</p>

      {falha && <div className="erro-caixa">{falha}</div>}

      {visiveis.map((p) => (
        <div key={p.id}>
          <Campo
            pergunta={p}
            valor={respostas[p.id]}
            erro={erros[p.id]}
            aoMudar={(v) => definir(p.id, v)}
          />
          {p.id === 'quantas_criancas' && <ResumoGrupo respostas={respostas} />}
        </div>
      ))}

      <div className="navegacao">
        {passo > 1 && (
          <button type="button" className="botao botao-voltar" onClick={voltar}>
            Voltar
          </button>
        )}
        <button
          type="button"
          className="botao botao-principal"
          onClick={passo === ultimo ? enviar : avancar}
          disabled={enviando}
        >
          {enviando
            ? 'Enviando…'
            : passo === ultimo
              ? 'Enviar respostas'
              : 'Continuar'}
        </button>
      </div>
    </>
  );
}

function ResumoGrupo({ respostas }: { respostas: Respostas }) {
  const total = somarPessoas(respostas);
  if (total === null) return null;

  const adultos = Number(respostas.quantos_adultos);
  const criancas = Number(respostas.quantas_criancas ?? 0);
  const texto = (n: number, um: string, muitos: string) =>
    `${n} ${n === 1 ? um : muitos}`;

  return (
    <div className="resumo">
      <strong>{texto(total, 'pessoa no total', 'pessoas no total')}</strong>
      {': '}
      {texto(adultos, 'adulto', 'adultos')}
      {criancas > 0 && ` e ${texto(criancas, 'criança', 'crianças')}`}
    </div>
  );
}

// ===================================================================== campo

function Campo({
  pergunta: p,
  valor,
  erro,
  aoMudar,
}: {
  pergunta: Pergunta;
  valor: any;
  erro?: string;
  aoMudar: (v: any) => void;
}) {
  if (p.tipo === 'aceite') {
    return (
      <div className="campo">
        <button
          type="button"
          className={`aceite ${valor === true ? 'marcada' : ''}`}
          onClick={() => aoMudar(valor !== true)}
          aria-pressed={valor === true}
        >
          <span className="marca quadrada" />
          <span>{p.rotulo}</span>
        </button>
        {erro && <span className="erro">{erro}</span>}
      </div>
    );
  }

  return (
    <div className="campo">
      <label className="rotulo" htmlFor={p.id}>
        {p.rotulo}
      </label>
      {p.ajuda && <span className="ajuda">{p.ajuda}</span>}

      {(p.tipo === 'texto' || p.tipo === 'email' || p.tipo === 'numero') && (
        <input
          id={p.id}
          className={`entrada ${erro ? 'invalida' : ''}`}
          type={p.tipo === 'email' ? 'email' : p.tipo === 'numero' ? 'number' : 'text'}
          inputMode={p.tipo === 'numero' ? 'numeric' : undefined}
          min={p.min}
          max={p.max}
          value={valor ?? ''}
          onChange={(e) =>
            aoMudar(p.tipo === 'numero' ? e.target.value.replace(/\D/g, '') : e.target.value)
          }
        />
      )}

      {p.tipo === 'telefone' && (
        <input
          id={p.id}
          className={`entrada ${erro ? 'invalida' : ''}`}
          type="tel"
          inputMode="tel"
          placeholder="(51) 99999-0000"
          value={valor ?? ''}
          onChange={(e) => aoMudar(mascararTelefone(e.target.value))}
        />
      )}

      {p.tipo === 'mes_ano' && (
        <div className="par">
          <select
            id={p.id}
            className={`entrada ${erro ? 'invalida' : ''}`}
            value={valor ? String(valor).slice(5, 7) : ''}
            onChange={(e) =>
              aoMudar(`${valor ? String(valor).slice(0, 4) : ANOS[0]}-${e.target.value}`)
            }
          >
            <option value="">Mês</option>
            {mesesDisponiveis(
              valor ? Number(String(valor).slice(0, 4)) : ANOS[0],
            ).map((m) => (
              <option key={m.nome} value={String(m.numero).padStart(2, '0')}>
                {m.nome}
              </option>
            ))}
          </select>
          <select
            className={`entrada ${erro ? 'invalida' : ''}`}
            value={valor ? String(valor).slice(0, 4) : ''}
            onChange={(e) =>
              aoMudar(`${e.target.value}-${valor ? String(valor).slice(5, 7) : '01'}`)
            }
          >
            <option value="">Ano</option>
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {p.tipo === 'escolha' && (
        <div className="opcoes" role="radiogroup" aria-labelledby={p.id}>
          {p.opcoes!.map((o) => (
            <button
              type="button"
              key={o}
              role="radio"
              aria-checked={valor === o}
              className={`opcao ${valor === o ? 'marcada' : ''}`}
              onClick={() => aoMudar(o)}
            >
              <span className="marca redonda" />
              <span>{o}</span>
            </button>
          ))}
        </div>
      )}

      {p.tipo === 'multipla' && (
        <div className="opcoes">
          {p.opcoes!.map((o) => {
            const lista: string[] = Array.isArray(valor) ? valor : [];
            const marcada = lista.includes(o);
            return (
              <button
                type="button"
                key={o}
                aria-pressed={marcada}
                className={`opcao ${marcada ? 'marcada' : ''}`}
                onClick={() =>
                  aoMudar(
                    marcada ? lista.filter((x) => x !== o) : [...lista, o],
                  )
                }
              >
                <span className="marca quadrada" />
                <span>{o}</span>
              </button>
            );
          })}
        </div>
      )}

      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}
