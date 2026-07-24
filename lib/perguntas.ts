/**
 * DISNEY EXPERT · Definição das perguntas
 *
 * Este arquivo é a única fonte de verdade do formulário. Quatro partes do
 * sistema leem daqui:
 *
 *   1. a interface, que desenha os campos e os passos
 *   2. a validação, tanto no navegador quanto no servidor
 *   3. a gravação, que monta o JSONB e preenche as colunas promovidas
 *   4. o briefing enviado ao agente, que segue esta mesma ordem
 *
 * Acrescentar uma pergunta é acrescentar um objeto neste array. Nada mais
 * precisa mudar, exceto quando a pergunta também vira coluna no banco.
 *
 * Ao alterar qualquer coisa aqui, suba VERSAO_FORMULARIO. É o que permite
 * ler corretamente registros antigos depois que o formulário evoluir.
 */

export const VERSAO_FORMULARIO = 3;

export type TipoCampo =
  | 'texto'
  | 'email'
  | 'telefone'
  | 'numero'
  | 'escolha'      // uma opção
  | 'multipla'     // várias opções
  | 'mes_ano'      // período previsto da viagem
  | 'aceite';      // caixa de consentimento

export interface Pergunta {
  /** Chave dentro de solicitacoes.respostas. Nunca renomeie depois de publicado. */
  id: string;
  passo: number;
  rotulo: string;
  ajuda?: string;
  tipo: TipoCampo;
  obrigatoria: boolean;
  opcoes?: string[];
  min?: number;
  max?: number;
  /** Só aparece quando a pergunta indicada tiver um dos valores listados. */
  condicao?: { pergunta: string; valores: string[] };
  /** Nome da coluna em solicitacoes que recebe uma cópia consultável. */
  coluna?: string;
}

export const PASSOS = [
  {
    numero: 1,
    titulo: 'Dados pessoais',
    curto: 'Você',
    descricao: 'Para o seu consultor falar com você',
  },
  {
    numero: 2,
    titulo: 'Quem irá viajar?',
    curto: 'O grupo',
    descricao: 'A composição da viagem',
  },
  {
    numero: 3,
    titulo: 'Data e origem',
    curto: 'Quando',
    descricao: 'Período, embarque e duração',
  },
  {
    numero: 4,
    titulo: 'Hospedagens',
    curto: 'Onde ficar',
    descricao: 'O estilo que combina com vocês',
  },
  {
    numero: 5,
    titulo: 'Parques e deslocamento',
    curto: 'Parques',
    descricao: 'O que não pode faltar',
  },
] as const;

export const PERGUNTAS: Pergunta[] = [
  // ---------------------------------------------------------------- passo 1
  {
    id: 'nome_completo',
    passo: 1,
    rotulo: 'Nome completo',
    tipo: 'texto',
    obrigatoria: true,
    coluna: 'cliente_nome',
  },
  {
    id: 'email',
    passo: 1,
    rotulo: 'E-mail',
    tipo: 'email',
    obrigatoria: true,
    coluna: 'cliente_email',
  },
  {
    id: 'whatsapp',
    passo: 1,
    rotulo: 'WhatsApp',
    ajuda: 'Com DDD. É por aqui que seu consultor vai retomar o contato.',
    tipo: 'telefone',
    obrigatoria: true,
    coluna: 'cliente_whatsapp',
  },

  // ---------------------------------------------------------------- passo 2
  {
    id: 'quantos_adultos',
    passo: 2,
    rotulo: 'Quantos adultos vão viajar?',
    ajuda: 'Considere adultos todos a partir de 9 anos.',
    tipo: 'numero',
    obrigatoria: true,
    min: 1,
    max: 30,
  },
  {
    id: 'quantas_criancas',
    passo: 2,
    rotulo: 'E quantas crianças?',
    ajuda: 'Crianças de 0 a 8 anos. Se não houver nenhuma, informe 0.',
    tipo: 'numero',
    obrigatoria: true,
    min: 0,
    max: 20,
    coluna: 'total_criancas',
  },
  {
    id: 'primeira_viagem',
    passo: 2,
    rotulo: 'Essa é a primeira viagem para a Disney?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Sim, é a primeira vez',
      'Já fomos uma vez',
      'Já fomos mais de uma vez',
    ],
    coluna: 'primeira_viagem',
  },

  // ---------------------------------------------------------------- passo 3
  {
    id: 'data_prevista',
    passo: 3,
    rotulo: 'Qual a data prevista para viver essa experiência?',
    ajuda: 'Se ainda não tem data fechada, informe o mês que tem em mente.',
    tipo: 'mes_ano',
    obrigatoria: true,
    coluna: 'data_prevista',
  },
  {
    id: 'origem_embarque',
    passo: 3,
    rotulo: 'De qual cidade vocês embarcam?',
    tipo: 'texto',
    obrigatoria: true,
    coluna: 'origem_embarque',
  },
  {
    id: 'dias_orlando',
    passo: 3,
    rotulo: 'Quantos dias de permanência em Orlando?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Até 7 dias',
      'De 8 a 10 dias',
      'De 11 a 14 dias',
      'Mais de 14 dias',
      'Ainda não sei',
    ],
    coluna: 'dias_orlando',
  },
  {
    id: 'dias_parques',
    passo: 3,
    rotulo: 'Quantos dias de parques você pretende incluir?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Até 4 dias',
      'De 5 a 7 dias',
      'De 8 a 10 dias',
      'Mais de 10 dias',
      'Ainda não sei, quero uma recomendação',
    ],
    coluna: 'dias_parques',
  },

  // ---------------------------------------------------------------- passo 4
  {
    id: 'estilo_hospedagem',
    passo: 4,
    rotulo: 'Qual o seu estilo de hospedagem ideal?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Hotel',
      'Casa de temporada com piscina',
      'Apartamento ou condo-hotel',
      'Quero comparar as opções',
    ],
  },
  {
    id: 'perfil_hotel',
    passo: 4,
    rotulo: 'Qual perfil de hotel combina mais com vocês?',
    tipo: 'escolha',
    obrigatoria: true,
    condicao: { pergunta: 'estilo_hospedagem', valores: ['Hotel'] },
    opcoes: [
      'Econômico, o essencial bem resolvido',
      'Intermediário, mais conforto e estrutura',
      'Luxo, experiência completa',
      'Quero comparar as categorias',
    ],
  },
  {
    id: 'hoteis_dentro_complexo',
    passo: 4,
    rotulo: 'Tem interesse em orçar hotéis dentro dos complexos Disney ou Universal?',
    ajuda: 'Ficar dentro dos complexos costuma dar entrada antecipada nos parques e transporte próprio.',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Sim, tenho interesse',
      'Não, prefiro ficar fora',
      'Quero comparar as duas possibilidades',
    ],
  },

  // ---------------------------------------------------------------- passo 5
  {
    id: 'parques',
    passo: 5,
    rotulo: 'Quais parques não podem faltar na sua viagem?',
    ajuda: 'Pode marcar quantos quiser.',
    tipo: 'multipla',
    obrigatoria: true,
    opcoes: [
      'Magic Kingdom',
      'EPCOT',
      'Disney\u2019s Hollywood Studios',
      'Disney\u2019s Animal Kingdom',
      'Universal Studios',
      'Islands of Adventure',
      'Epic Universe',
      'Volcano Bay',
      'SeaWorld',
      'Busch Gardens',
      'Ainda não sei, quero uma recomendação',
    ],
    coluna: 'parques',
  },
  {
    id: 'locomocao',
    passo: 5,
    rotulo: 'Como você planeja se locomover em Orlando?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Carro alugado',
      'Transfer contratado',
      'Aplicativo, como Uber',
      'Transporte do hotel',
      'Ainda não sei',
    ],
  },
  {
    id: 'consentimento_lgpd',
    passo: 5,
    rotulo:
      'Autorizo o uso destes dados para a elaboração da minha proposta de viagem.',
    tipo: 'aceite',
    obrigatoria: true,
    coluna: 'consentimento_lgpd',
  },
];

// =====================================================================
// Utilitários usados pela interface, pela validação e pela gravação
// =====================================================================

export const perguntasDoPasso = (passo: number): Pergunta[] =>
  PERGUNTAS.filter((p) => p.passo === passo);

export const buscarPergunta = (id: string): Pergunta | undefined =>
  PERGUNTAS.find((p) => p.id === id);

/** Uma pergunta condicional só é exigida quando a condição está satisfeita. */
export function perguntaVisivel(
  pergunta: Pergunta,
  respostas: Record<string, unknown>,
): boolean {
  if (!pergunta.condicao) return true;
  const valor = respostas[pergunta.condicao.pergunta];
  return typeof valor === 'string' && pergunta.condicao.valores.includes(valor);
}

/**
 * Converte a resposta em faixa para o número que vai na coluna.
 * A coluna guarda o piso da faixa, o que basta para ordenar e agrupar.
 * O texto exato continua íntegro no JSONB.
 */
const PISO_DA_FAIXA: Record<string, number | null> = {
  'Até 7 dias': 7,
  'De 8 a 10 dias': 8,
  'De 11 a 14 dias': 11,
  'Mais de 14 dias': 15,
  'Até 4 dias': 4,
  'De 5 a 7 dias': 5,
  'Mais de 10 dias': 11,
  'Ainda não sei': null,
  'Ainda não sei, quero uma recomendação': null,
};

/** Converte texto do formulário em número, ou nulo quando vazio. */
export function paraNumero(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * O total do grupo é a soma, nunca um campo digitado.
 * Assim não existe a dúvida de saber se as crianças estavam ou não
 * incluídas no total informado.
 */
export function somarPessoas(respostas: Record<string, any>): number | null {
  const adultos = paraNumero(respostas.quantos_adultos);
  const criancas = paraNumero(respostas.quantas_criancas);
  if (adultos === null) return null;
  return adultos + (criancas ?? 0);
}

/**
 * Monta o objeto que a aplicação usa para preencher as colunas promovidas
 * de solicitacoes. O JSONB completo é gravado separadamente, sem passar
 * por nenhuma transformação.
 */
export function projetarColunas(respostas: Record<string, any>) {
  const primeira = respostas.primeira_viagem as string | undefined;

  return {
    cliente_nome: respostas.nome_completo ?? null,
    cliente_email: respostas.email ?? null,
    cliente_whatsapp: respostas.whatsapp ?? null,
    total_pessoas: somarPessoas(respostas),
    total_criancas: paraNumero(respostas.quantas_criancas),
    primeira_viagem: primeira ? primeira.startsWith('Sim') : null,
    origem_embarque: respostas.origem_embarque ?? null,
    dias_orlando: PISO_DA_FAIXA[respostas.dias_orlando] ?? null,
    dias_parques: PISO_DA_FAIXA[respostas.dias_parques] ?? null,
    parques: Array.isArray(respostas.parques) ? respostas.parques : null,
    consentimento_lgpd: respostas.consentimento_lgpd === true,
  };
}

/**
 * Percentual de perguntas visíveis efetivamente respondidas.
 * Vai para solicitacoes.completude e diz à especialista o quanto
 * ela precisa perguntar antes de conseguir orçar.
 */
export function calcularCompletude(respostas: Record<string, unknown>): number {
  const visiveis = PERGUNTAS.filter(
    (p) => p.tipo !== 'aceite' && perguntaVisivel(p, respostas),
  );
  const respondidas = visiveis.filter((p) => {
    const v = respostas[p.id];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });
  return Math.round((respondidas.length / visiveis.length) * 100);
}
