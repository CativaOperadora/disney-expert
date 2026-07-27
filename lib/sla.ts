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

export const MOTIVOS_PERDA = [
  ['sem_retorno_agencia', 'Sem retorno da agência'],
  ['cliente_desistiu', 'Cliente desistiu'],
  ['perdido_concorrencia', 'Perdido para concorrência'],
  ['fora_de_perfil', 'Fora de perfil'],
] as const;
