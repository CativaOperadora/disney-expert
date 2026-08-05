'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  PASSOS,
  PERGUNTAS,
  perguntasDoPasso,
  perguntaVisivel,
  somarPessoas,
  quantidadeDeCampos,
  idadesValidas,
  periodoMinimo,
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

/**
 * Meses disponíveis, gerados a partir de HOJE — nunca uma lista fixa.
 *
 * A versão anterior tinha dois seletores, mês e ano. O de mês era
 * filtrado pelo ano ESCOLHIDO, e antes de escolher o ano ele assumia o
 * corrente: quem abria o formulário via só os meses que restavam de 2026
 * e concluía que 2027 não existia. Agora é um seletor só, com o par
 * mês/ano já pronto, e a lista anda sozinha com o calendário.
 */
const MESES_A_FRENTE = 36;

function periodosDisponiveis() {
  const lista: { valor: string; rotulo: string }[] = [];
  for (let i = 0; i < MESES_A_FRENTE; i++) {
    const d = new Date(ANO_ATUAL, HOJE.getMonth() + i, 1);
    const ano = d.getFullYear();
    const mes = d.getMonth();
    lista.push({
      valor: `${ano}-${String(mes + 1).padStart(2, '0')}`,
      rotulo: `${MESES[mes]} de ${ano}`,
    });
  }
  return lista;
}

const PERIODOS = periodosDisponiveis();
/** Mesma regra que o servidor aplica — fonte única em lib/perguntas. */
const PERIODO_MINIMO = periodoMinimo(HOJE);

/** Data de hoje em ISO (YYYY-MM-DD), usada como mínimo do seletor de dia. */
const ISO_HOJE = `${ANO_ATUAL}-${String(MES_ATUAL).padStart(2, '0')}-${String(
  HOJE.getDate(),
).padStart(2, '0')}`;

// --- busca de cidades (autocomplete) ---------------------------------------
// A lista completa de municípios brasileiros vive em /cidades.json e é
// carregada sob demanda, na primeira vez que o campo de cidade aparece.
let cacheCidades: string[] | null = null;
let promessaCidades: Promise<string[]> | null = null;

function carregarCidades(): Promise<string[]> {
  if (cacheCidades) return Promise.resolve(cacheCidades);
  if (!promessaCidades) {
    promessaCidades = fetch('/cidades.json')
      .then((r) => r.json())
      .then((lista: string[]) => {
        cacheCidades = lista;
        return lista;
      })
      .catch(() => {
        promessaCidades = null;
        return [];
      });
  }
  return promessaCidades;
}

/** Remove acentos e caixa para comparar sem tropeçar em digitação. */
function normalizar(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mascararTelefone(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validar(p: Pergunta, valor: any, respostas: Respostas): string | null {
  const vazio =
    valor === undefined ||
    valor === null ||
    valor === '' ||
    (Array.isArray(valor) && valor.length === 0) ||
    (p.tipo === 'aceite' && valor !== true) ||
    (p.tipo === 'idades' && !Array.isArray(valor));

  if (vazio) {
    if (!p.obrigatoria) return null;
    if (p.tipo === 'aceite') return 'Precisamos da sua autorização para seguir.';
    if (p.tipo === 'multipla') return 'Escolha ao menos uma opção.';
    if (p.tipo === 'escolha') return 'Escolha uma opção.';
    if (p.tipo === 'idades') return 'Informe a idade de cada criança.';
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
    if (!/^\d{4}-\d{2}$/.test(valor)) return 'Escolha o período da viagem.';
    // Comparação de texto basta: YYYY-MM ordena cronologicamente.
    if (String(valor) < PERIODO_MINIMO) return 'Escolha um período a partir deste mês.';
  }
  if (p.tipo === 'idades' && !idadesValidas(p, { ...respostas, [p.id]: valor })) {
    return `Informe a idade de cada criança, de ${p.min} a ${p.max} anos.`;
  }
  if (p.tipo === 'data') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'Selecione uma data válida.';
    if (String(valor) < ISO_HOJE) return 'Escolha uma data a partir de hoje.';
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
    setRespostas((r) => {
      const novo = { ...r, [id]: valor };
      // Se esta mudança escondeu alguma pergunta condicional (por exemplo,
      // trocar "já tenho a data" por "só uma previsão"), a resposta antiga
      // dela é descartada. Assim as respostas guardadas refletem sempre o
      // que o cliente realmente vê na tela.
      for (const p of PERGUNTAS) {
        if (novo[p.id] !== undefined && !perguntaVisivel(p, novo)) {
          delete novo[p.id];
        }
      }
      return novo;
    });
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
      const erro = validar(p, respostas[p.id], respostas);
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
          <div className="convite-rotulo">Sua viagem para Orlando com:</div>
          <div className="convite-nome">
            {agenteNome} – {agenciaNome}
          </div>
          <p className="convite-chamada">
            Preencha o formulário para receber um atendimento personalizado.
          </p>
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
            quantidade={quantidadeDeCampos(p, respostas)}
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
  quantidade = 0,
}: {
  pergunta: Pergunta;
  valor: any;
  erro?: string;
  aoMudar: (v: any) => void;
  /** Só para tipo 'idades': quantos campos desenhar. Calculado por quem
      tem as respostas, para o componente não precisar do estado inteiro. */
  quantidade?: number;
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

      {p.tipo === 'cidade' && (
        <CampoCidade id={p.id} valor={valor} erro={erro} aoMudar={aoMudar} />
      )}

      {p.tipo === 'data' && (
        <input
          id={p.id}
          className={`entrada ${erro ? 'invalida' : ''}`}
          type="date"
          min={ISO_HOJE}
          value={valor ?? ''}
          onChange={(e) => aoMudar(e.target.value)}
        />
      )}

      {p.tipo === 'mes_ano' && (
        <select
          id={p.id}
          className={`entrada ${erro ? 'invalida' : ''}`}
          value={valor ? String(valor) : ''}
          onChange={(e) => aoMudar(e.target.value)}
        >
          <option value="">Selecione o mês e o ano</option>
          {PERIODOS.map((pd) => (
            <option key={pd.valor} value={pd.valor}>
              {pd.rotulo}
            </option>
          ))}
        </select>
      )}

      {/* Um campo por criança. A quantidade vem de `quantas_criancas`, e o
          array acompanha: reduzir o número descarta as idades sobrando, em
          vez de deixar valores fantasmas de uma escolha anterior. */}
      {p.tipo === 'idades' && (
        <div className="idades-grade">
          {Array.from({ length: quantidade }, (_, i) => (
            <div className="idade-campo" key={i}>
              <label className="idade-rotulo" htmlFor={`${p.id}-${i}`}>
                Criança {i + 1}
              </label>
              <input
                id={`${p.id}-${i}`}
                className={`entrada ${erro ? 'invalida' : ''}`}
                type="number"
                inputMode="numeric"
                min={p.min}
                max={p.max}
                placeholder="anos"
                value={
                  Array.isArray(valor) && valor[i] !== undefined && valor[i] !== null
                    ? String(valor[i])
                    : ''
                }
                onChange={(e) => {
                  const atual = Array.isArray(valor) ? [...valor] : [];
                  const qtd = quantidade;
                  atual.length = qtd;
                  atual[i] = e.target.value === '' ? null : Number(e.target.value);
                  aoMudar(atual);
                }}
              />
            </div>
          ))}
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

// ============================================================ campo de cidade

function CampoCidade({
  id,
  valor,
  erro,
  aoMudar,
}: {
  id: string;
  valor: any;
  erro?: string;
  aoMudar: (v: any) => void;
}) {
  const [cidades, setCidades] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  useEffect(() => {
    let vivo = true;
    carregarCidades().then((lista) => {
      if (vivo) setCidades(lista);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Pré-normaliza a lista uma vez, para filtrar rápido a cada tecla.
  const pares = useMemo(
    () => cidades.map((c) => ({ c, n: normalizar(c) })),
    [cidades],
  );

  const texto = valor ?? '';
  const alvo = normalizar(String(texto));

  const sugestoes = useMemo(() => {
    if (alvo.length < 2) return [];
    const comeca: string[] = [];
    const contem: string[] = [];
    for (const p of pares) {
      if (p.n.startsWith(alvo)) comeca.push(p.c);
      else if (p.n.includes(alvo)) contem.push(p.c);
      if (comeca.length >= 8) break;
    }
    return [...comeca, ...contem].slice(0, 8);
  }, [pares, alvo]);

  // A cidade escolhida já corresponde exatamente a um item: não sugere mais.
  const jaSelecionada =
    sugestoes.length === 1 && normalizar(sugestoes[0]) === alvo;
  const mostrar = aberto && sugestoes.length > 0 && !jaSelecionada;

  function escolher(cidade: string) {
    aoMudar(cidade);
    setAberto(false);
  }

  return (
    <div className="cidade-busca">
      <input
        id={id}
        className={`entrada ${erro ? 'invalida' : ''}`}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={mostrar}
        aria-autocomplete="list"
        placeholder="Comece a digitar sua cidade"
        value={texto}
        onChange={(e) => {
          aoMudar(e.target.value);
          setAberto(true);
          setDestaque(0);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => window.setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (!mostrar) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDestaque((d) => Math.min(d + 1, sugestoes.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestaque((d) => Math.max(d - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            escolher(sugestoes[destaque]);
          } else if (e.key === 'Escape') {
            setAberto(false);
          }
        }}
      />
      {mostrar && (
        <ul className="cidade-lista" role="listbox">
          {sugestoes.map((c, i) => (
            <li
              key={c}
              role="option"
              aria-selected={i === destaque}
              className={`cidade-item ${i === destaque ? 'destaque' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(c);
              }}
              onMouseEnter={() => setDestaque(i)}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
