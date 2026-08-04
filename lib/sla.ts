/**
 * SLA de primeiro atendimento.
 *
 * O relógio mede o tempo até a especialista assumir a solicitação, não
 * até concluir a consultoria. Começa quando o formulário chega e para
 * quando a solicitação sai de "Nova solicitação".
 *
 * Prazo em horas corridas: 24h para agência Select, 48h para as demais.
 * Corridas, e não úteis, conforme definido pelo cliente. Consequência
 * conhecida: um pedido que chega sexta às 17h vence domingo às 17h.
 */

export type FaixaSla = 'atendido' | 'tranquilo' | 'atencao' | 'urgente' | 'atrasado';

export interface Sla {
  faixa: FaixaSla;
  rotulo: string;
  /** Fração do prazo já consumida, de 0 a 1. Usada na barra. */
  consumido: number;
  horasRestantes: number;
}

function humanizar(horas: number): string {
  const h = Math.abs(horas);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)} dias`;
}

export function calcularSla(
  criadoEm: string,
  slaHoras: number,
  primeiroAtendimentoEm: string | null,
  agora: number = Date.now(),
): Sla {
  const inicio = new Date(criadoEm).getTime();
  const prazoMs = slaHoras * 3_600_000;
  const vence = inicio + prazoMs;

  // Já atendida: o relógio parou. Mostra quanto tempo levou.
  if (primeiroAtendimentoEm) {
    const levou = (new Date(primeiroAtendimentoEm).getTime() - inicio) / 3_600_000;
    const dentro = levou <= slaHoras;
    return {
      faixa: 'atendido',
      rotulo: dentro
        ? `Atendido em ${humanizar(levou)}`
        : `Atendido com atraso, ${humanizar(levou)}`,
      consumido: Math.min(1, levou / slaHoras),
      horasRestantes: 0,
    };
  }

  const restanteMs = vence - agora;
  const horasRestantes = restanteMs / 3_600_000;
  const consumido = Math.min(1, Math.max(0, (agora - inicio) / prazoMs));

  if (restanteMs <= 0) {
    return {
      faixa: 'atrasado',
      rotulo: `Atrasado há ${humanizar(horasRestantes)}`,
      consumido: 1,
      horasRestantes,
    };
  }

  const restante = restanteMs / prazoMs;
  const faixa: FaixaSla =
    restante > 0.5 ? 'tranquilo' : restante > 0.25 ? 'atencao' : 'urgente';

  return {
    faixa,
    rotulo: `Vence em ${humanizar(horasRestantes)}`,
    consumido,
    horasRestantes,
  };
}

// A coluna "Em atendimento" foi removida do fluxo. O id 'consultoria_realizada'
// é mantido (preserva o enum do banco e os registros existentes); apenas o
// rótulo passou a "Em consultoria", deixando claro que ainda está em andamento.
export const STATUS = [
  { id: 'nova_solicitacao',      titulo: 'Nova solicitação',   nota: 'Chegou, ninguém assumiu' },
  { id: 'consultoria_realizada', titulo: 'Em consultoria',     nota: 'Consultoria em andamento com a agência' },
  { id: 'venda_finalizada',      titulo: 'Venda finalizada',   nota: 'Reserva confirmada' },
  { id: 'venda_perdida',         titulo: 'Venda perdida',      nota: '' },
  { id: 'concluida',             titulo: 'Concluídas',         nota: 'Encerrada e arquivada' },
] as const;

export const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  STATUS.map((s) => [s.id, s.titulo]),
);

/**
 * Motivos oferecidos ao especialista ao registrar uma perda.
 *
 * Esta lista é a da INTERFACE. O enum motivo_perda no banco ainda contém
 * os quatro motivos antigos, porque registros gravados os referenciam —
 * ver migração 009. Para exibir um registro histórico, use ROTULO_MOTIVO,
 * que conhece os dois conjuntos.
 */
export const MOTIVOS_PERDA = [
  ['preco', 'Desistência relacionada ao preço'],
  ['outro_roteiro', 'Cliente preferiu outro roteiro'],
  ['demora_retorno', 'Demora no retorno operacional'],
] as const;

/** Motivos descontinuados: não aparecem mais na escolha, mas ainda são lidos. */
const MOTIVOS_HISTORICOS = [
  ['sem_retorno_agencia', 'Sem retorno da agência'],
  ['cliente_desistiu', 'Cliente desistiu'],
  ['perdido_concorrencia', 'Perdido para concorrência'],
  ['fora_de_perfil', 'Fora de perfil'],
] as const;

/** Rótulo de qualquer motivo, atual ou histórico. */
export const ROTULO_MOTIVO: Record<string, string> = Object.fromEntries(
  [...MOTIVOS_PERDA, ...MOTIVOS_HISTORICOS],
);
