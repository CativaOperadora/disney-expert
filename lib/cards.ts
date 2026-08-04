import { sql } from './db';
import type { SessaoPortal } from './portal-auth';

/**
 * Cards por lado — a fronteira entre os dois pipelines.
 *
 * REGRA ÚNICA
 *   Toda consulta a estado operacional (status, valor, motivo de perda)
 *   passa por aqui e declara o lado. Não existe função neutra: se alguém
 *   esquecer o lado, o TypeScript reclama. É o que impede um lado de ler
 *   o estado do outro por descuido.
 *
 *     lado 'consultoria' -> CRM interno da Cativa
 *     lado 'agencia'     -> Portal do Agente
 *
 * POR QUE OS NÚMEROS DIVERGEM
 *   A agência ajusta a própria comissão: pode reduzi-la para dar desconto
 *   ao cliente, ou aumentá-la e cobrar mais do agente. O que a Cativa
 *   recebe e o que a agência recebe são grandezas diferentes. Divergência
 *   entre os dashboards é o comportamento correto, não um defeito.
 */

export type Lado = 'consultoria' | 'agencia';

export interface Card {
  id: string;
  solicitacao_id: string;
  lado: Lado;
  status: string;
  status_em: string | null;
  primeiro_atendimento_em: string | null;
  responsavel_id: string | null;
  valor_total_venda: string | null;
  venda_em: string | null;
  id_reserva: string | null;
  motivo_perda: string | null;
  descricao_perda: string | null;
}

/**
 * Junta o card de um lado a uma consulta sobre `solicitacoes s`.
 * O alias é fixo em `c` de propósito: interpolar identificador dinâmico
 * aqui só criaria superfície para erro, e um alias basta em toda consulta.
 */
export function juntarCard(lado: Lado) {
  return sql`join cards c on c.solicitacao_id = s.id and c.lado = ${lado}::lado_card`;
}

/** Cria os dois cards de uma solicitação recém-recebida. */
export async function criarCards(solicitacaoId: string): Promise<void> {
  await sql`
    insert into cards (solicitacao_id, lado, status, status_em)
    values (${solicitacaoId}, 'consultoria', 'nova_solicitacao', now()),
           (${solicitacaoId}, 'agencia',     'nova_solicitacao', now())
    on conflict (solicitacao_id, lado) do nothing
  `;
}

export async function buscarCard(
  solicitacaoId: string,
  lado: Lado,
): Promise<Card | null> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId)) return null;
  const [c] = await sql<Card[]>`
    select id, solicitacao_id, lado::text, status::text, status_em,
           primeiro_atendimento_em, responsavel_id, valor_total_venda,
           venda_em, id_reserva, motivo_perda::text, descricao_perda
    from cards
    where solicitacao_id = ${solicitacaoId} and lado = ${lado}::lado_card
  `;
  return c ?? null;
}

export interface MudancaStatus {
  status: string;
  motivo?: string | null;
  descricao?: string | null;
  responsavel?: string | null;
  valor?: number | null;
}

/**
 * Move um card de etapa, marcando os relógios do próprio lado.
 *
 * `primeiro_atendimento_em` e `venda_em` são carimbados por lado: o SLA da
 * consultoria não é afetado pelo que a agência faz, e vice-versa.
 */
export async function moverCard(
  solicitacaoId: string,
  lado: Lado,
  m: MudancaStatus,
): Promise<boolean> {
  const r = await sql`
    update cards set
      status = ${m.status}::status_solicitacao,
      motivo_perda = ${m.motivo ?? null}::motivo_perda,
      descricao_perda = ${m.descricao ?? null},
      responsavel_id = coalesce(${m.responsavel ?? null}::uuid, responsavel_id),
      valor_total_venda = coalesce(${m.valor ?? null}, valor_total_venda),
      status_em = case
        when status <> ${m.status}::status_solicitacao then now() else status_em end,
      primeiro_atendimento_em = case
        when ${m.status} <> 'nova_solicitacao' and primeiro_atendimento_em is null
        then now() else primeiro_atendimento_em end,
      venda_em = case
        when ${m.status} = 'venda_finalizada' and venda_em is null
        then now() else venda_em end
    where solicitacao_id = ${solicitacaoId} and lado = ${lado}::lado_card
  `;
  return r.count > 0;
}

/** Grava um campo simples do card (valor da venda ou ID da reserva). */
export async function atualizarCampoCard(
  solicitacaoId: string,
  lado: Lado,
  campo: 'valor_total_venda' | 'id_reserva',
  valor: number | string | null,
): Promise<boolean> {
  const r =
    campo === 'valor_total_venda'
      ? await sql`update cards set valor_total_venda = ${valor as number | null}
                  where solicitacao_id = ${solicitacaoId} and lado = ${lado}::lado_card`
      : await sql`update cards set id_reserva = ${valor as string | null}
                  where solicitacao_id = ${solicitacaoId} and lado = ${lado}::lado_card`;
  return r.count > 0;
}

export async function atribuirResponsavel(
  solicitacaoId: string,
  responsavelId: string | null,
): Promise<boolean> {
  // Responsável só existe na consultoria: é a especialista que conduz.
  const r = await sql`
    update cards set responsavel_id = ${responsavelId}
    where solicitacao_id = ${solicitacaoId} and lado = 'consultoria'
  `;
  return r.count > 0;
}

/**
 * Escopo do Portal aplicado ao card da agência.
 *
 * Agente move os cards que ele captou; admin move qualquer um da agência.
 * O recorte vem da sessão, nunca da requisição.
 */
export async function moverCardAgencia(
  sess: SessaoPortal,
  solicitacaoId: string,
  status: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId)) return false;

  const [permitido] = await sql<{ id: string }[]>`
    select s.id from solicitacoes s
    where s.id = ${solicitacaoId}
      and ${sess.admin
        ? sql`s.agencia_id = ${sess.agenciaId}`
        : sql`s.agente_id = ${sess.agenteId}`}
    limit 1
  `;
  if (!permitido) return false;

  // Sem motivo de perda: o agente não registra motivo, por decisão de
  // produto. A constraint do banco só exige motivo no lado consultoria.
  return moverCard(solicitacaoId, 'agencia', { status });
}
