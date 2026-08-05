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

export const VERSAO_FORMULARIO = 5;

export type TipoCampo =
  | 'texto'
  | 'email'
  | 'telefone'
  | 'numero'
  | 'cidade'       // busca inteligente de cidade brasileira
  | 'escolha'      // uma opção
  | 'multipla'     // várias opções
  | 'mes_ano'      // período previsto da viagem
  | 'data'         // dia exato da viagem
  | 'idades'       // uma idade por criança, quantidade vinda de outra pergunta
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
  /**
   * Só aparece quando a pergunta indicada satisfizer a condição.
   *
   * `valores` compara texto; `minimo` compara número. O segundo existe
   * porque "tem pelo menos uma criança" não é uma escolha de lista — é
   * uma quantidade digitada, e listar "1","2","3"… seria frágil.
   */
  condicao?:
    | { pergunta: string; valores: string[] }
    | { pergunta: string; minimo: number };

  /** Só para tipo 'idades': de qual pergunta sai a quantidade de campos. */
  quantidadeDe?: string;
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
    // Um campo por criança, gerado a partir de `quantas_criancas`.
    // A idade é a DA VIAGEM, não a de hoje: parque cobra pela idade no
    // dia da visita, e uma viagem daqui a um ano muda a faixa de quem
    // está perto do aniversário.
    id: 'idades_criancas',
    passo: 2,
    rotulo: 'Idade de cada criança na data da viagem',
    ajuda:
      'Quantos anos cada uma terá quando viajarem. É o que define o valor do ingresso.',
    tipo: 'idades',
    obrigatoria: true,
    quantidadeDe: 'quantas_criancas',
    condicao: { pergunta: 'quantas_criancas', minimo: 1 },
    // 0 a 8 para não contradizer a pergunta anterior, que define adulto a
    // partir de 9 anos. Ver nota sobre a régua dos parques no schema.
    min: 0,
    max: 8,
    coluna: 'idades_criancas',
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
    id: 'tem_data_definida',
    passo: 3,
    rotulo: 'Você já tem a data da viagem definida?',
    tipo: 'escolha',
    obrigatoria: true,
    opcoes: [
      'Sim, já tenho a data definida',
      'Ainda não, tenho só uma previsão',
    ],
  },
  {
    id: 'data_exata',
    passo: 3,
    rotulo: 'Qual o dia da viagem?',
    ajuda: 'Selecione a data de embarque.',
    tipo: 'data',
    obrigatoria: true,
    condicao: { pergunta: 'tem_data_definida', valores: ['Sim, já tenho a data definida'] },
  },
  {
    id: 'data_prevista',
    passo: 3,
    rotulo: 'Qual a data prevista para viver essa experiência?',
    ajuda: 'Informe o mês e o ano que você tem em mente.',
    tipo: 'mes_ano',
    obrigatoria: true,
    condicao: { pergunta: 'tem_data_definida', valores: ['Ainda não, tenho só uma previsão'] },
    coluna: 'data_prevista',
  },
  {
    id: 'origem_embarque',
    passo: 3,
    rotulo: 'De qual cidade vocês embarcam?',
    ajuda: 'Comece a digitar e selecione a cidade na lista.',
    tipo: 'cidade',
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
  // Opt-in de marketing: OPCIONAL e deliberadamente separado do aceite
  // acima. O consentimento obrigatório cobre só a elaboração da proposta;
  // campanha é outra finalidade e, pela LGPD, precisa de aceite próprio.
  // Marcar esta caixa nunca pode ser condição para enviar o formulário.
  {
    id: 'aceite_marketing',
    passo: 5,
    rotulo:
      'Quero receber ofertas e novidades de viagem da minha agência.',
    ajuda: 'Opcional. Você pode pedir a remoção quando quiser.',
    tipo: 'aceite',
    obrigatoria: false,
    coluna: 'aceite_marketing',
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
  const c = pergunta.condicao;
  if (!c) return true;
  const valor = respostas[c.pergunta];

  if ('minimo' in c) {
    const n = paraNumero(valor);
    return n !== null && n >= c.minimo;
  }
  return typeof valor === 'string' && c.valores.includes(valor);
}

/**
 * Quantos campos de idade mostrar. Limitado ao `max` da pergunta de
 * quantidade para uma digitação errada (200 crianças) não gerar uma tela
 * infinita nem um array absurdo no banco.
 */
export function quantidadeDeCampos(
  pergunta: Pergunta,
  respostas: Record<string, unknown>,
): number {
  if (!pergunta.quantidadeDe) return 0;
  const origem = buscarPergunta(pergunta.quantidadeDe);
  const teto = origem?.max ?? 20;
  const n = paraNumero(respostas[pergunta.quantidadeDe]) ?? 0;
  return Math.max(0, Math.min(Math.floor(n), teto));
}

/**
 * Regras de data, compartilhadas pelos dois lados.
 *
 * Ficavam só no navegador, o que deixava a API aceitar um período no
 * passado para quem postasse direto — a validação do cliente é
 * conveniência, não defesa. Comparação de texto basta: YYYY-MM e
 * YYYY-MM-DD ordenam cronologicamente.
 */
export function periodoMinimo(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export function periodoValido(v: unknown, agora = new Date()): boolean {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}$/.test(v) &&
    v >= periodoMinimo(agora)
  );
}

export function dataValida(v: unknown, agora = new Date()): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const hoje = `${periodoMinimo(agora)}-${String(agora.getDate()).padStart(2, '0')}`;
  return v >= hoje;
}

/**
 * [5, 8] → "5 e 8 anos".
 *
 * Um array só de números, no formulário, é sempre idade — nenhuma outra
 * pergunta guarda números em lista. Por isso reconhece pelo formato e não
 * precisa do id, o que deixa os três lugares que exibem respostas
 * (briefing, ficha do CRM, ficha do portal) usarem a mesma função sem
 * saber de qual pergunta o valor veio.
 */
export function textoIdades(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const n = v.map(paraNumero).filter((x): x is number => x !== null);
  if (n.length !== v.length) return null;

  const anos = (x: number) => (x === 1 ? '1 ano' : `${x} anos`);
  if (n.length === 1) return anos(n[0]);
  return `${n.slice(0, -1).join(', ')} e ${anos(n[n.length - 1])}`;
}

/** Idades válidas e completas para a quantidade de crianças informada. */
export function idadesValidas(
  pergunta: Pergunta,
  respostas: Record<string, unknown>,
): boolean {
  const esperado = quantidadeDeCampos(pergunta, respostas);
  const v = respostas[pergunta.id];
  if (!Array.isArray(v) || v.length !== esperado) return false;
  return v.every((x) => {
    const n = paraNumero(x);
    return (
      n !== null &&
      Number.isInteger(n) &&
      n >= (pergunta.min ?? 0) &&
      n <= (pergunta.max ?? 8)
    );
  });
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
 * Campos que representam uma quantidade de passageiros. O total de
 * viajantes é a soma de TODOS eles, nunca de um só. Para acrescentar uma
 * categoria nova no futuro (por exemplo, bebês), basta incluir o id aqui
 * e a soma passa a considerá-la automaticamente.
 */
export const CAMPOS_PESSOAS = ['quantos_adultos', 'quantas_criancas'] as const;

/**
 * O total do grupo é a soma de todas as categorias, nunca um campo
 * digitado. Assim não existe a dúvida de saber se as crianças estavam ou
 * não incluídas no total informado.
 */
export function somarPessoas(respostas: Record<string, any>): number | null {
  const quantidades = CAMPOS_PESSOAS
    .map((id) => paraNumero(respostas[id]))
    .filter((n): n is number => n !== null);
  if (quantidades.length === 0) return null;
  return quantidades.reduce((soma, n) => soma + n, 0);
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
    aceite_marketing: respostas.aceite_marketing === true,
    // Array de smallint. Vazio vira null: coluna sem valor é mais honesta
    // que um array vazio, que se confundiria com "informou nenhuma idade".
    idades_criancas: (() => {
      const v = respostas.idades_criancas;
      if (!Array.isArray(v) || v.length === 0) return null;
      const nums = v.map(paraNumero).filter((n): n is number => n !== null);
      return nums.length > 0 ? nums : null;
    })(),
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
