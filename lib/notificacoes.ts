import { sql } from './db';
import type { SessaoPortal } from './portal-auth';

/**
 * Central de Notificações do Portal.
 *
 * FRONTEIRA — nenhum evento do CRM interno gera notificação aqui. Avisar
 * a agência de que a especialista mudou de etapa exporia o andamento
 * interno pela porta dos fundos, justamente o que a separação de
 * pipelines existe para impedir. Todo gatilho nasce de uma ação do lado
 * da agência, ou da chegada de um lead (que é dela).
 *
 * FAN-OUT — uma linha por destinatário. O mesmo fato vira várias
 * notificações porque "lida" é individual: o admin marcar como lida não
 * pode apagar o aviso do agente.
 */

export type TipoNotificacao =
  | 'solicitacao_nova'
  | 'card_movido'
  | 'seguidor_adicionado'
  | 'venda_finalizada'
  | 'nota_agencia';

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  solicitacao_id: string | null;
  lida_em: string | null;
  criado_em: string;
}

/**
 * Quem deve saber de algo que aconteceu numa solicitação:
 * o agente dono, os administradores da agência e os seguidores.
 *
 * `exceto` tira quem provocou a ação — ninguém precisa ser notificado do
 * que acabou de fazer.
 */
async function destinatarios(
  solicitacaoId: string,
  exceto?: string | null,
): Promise<string[]> {
  const linhas = await sql<{ id: string }[]>`
    select distinct a.id
    from solicitacoes s
    join agentes a on a.agencia_id = s.agencia_id and a.ativo
    where s.id = ${solicitacaoId}
      and (
        a.id = s.agente_id                       -- o dono do card
        or a.admin                               -- administradores da agência
        or exists (select 1 from seguidores g    -- seguidores
                   where g.solicitacao_id = s.id and g.agente_id = a.id)
      )
  `;
  return linhas.map((l) => l.id).filter((id) => id !== exceto);
}

export async function notificar(
  solicitacaoId: string,
  tipo: TipoNotificacao,
  titulo: string,
  descricao: string | null,
  autor?: string | null,
): Promise<number> {
  const alvos = await destinatarios(solicitacaoId, autor);
  if (alvos.length === 0) return 0;

  await sql`
    insert into notificacoes (destinatario_id, solicitacao_id, tipo, titulo, descricao)
    select id, ${solicitacaoId}, ${tipo}, ${titulo}, ${descricao}
    from unnest(${alvos}::uuid[]) as id
  `;
  return alvos.length;
}

/** Notifica uma pessoa só (usado ao adicionar alguém como seguidor). */
export async function notificarUm(
  destinatarioId: string,
  solicitacaoId: string,
  tipo: TipoNotificacao,
  titulo: string,
  descricao: string | null,
): Promise<void> {
  await sql`
    insert into notificacoes (destinatario_id, solicitacao_id, tipo, titulo, descricao)
    values (${destinatarioId}, ${solicitacaoId}, ${tipo}, ${titulo}, ${descricao})
  `;
}

export async function listarNotificacoes(
  sess: SessaoPortal,
  limite = 30,
): Promise<Notificacao[]> {
  return sql<Notificacao[]>`
    select id::text, tipo, titulo, descricao, solicitacao_id, lida_em, criado_em
    from notificacoes
    where destinatario_id = ${sess.agenteId}
    order by criado_em desc
    limit ${limite}
  `;
}

export async function contarNaoLidas(sess: SessaoPortal): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int n from notificacoes
    where destinatario_id = ${sess.agenteId} and lida_em is null
  `;
  return r?.n ?? 0;
}

/**
 * Marca como lidas. Sempre restrito ao próprio destinatário — ninguém
 * marca a caixa de outra pessoa, nem por id forjado.
 */
export async function marcarLidas(
  sess: SessaoPortal,
  ids?: string[],
): Promise<number> {
  const r =
    ids && ids.length > 0
      ? await sql`
          update notificacoes set lida_em = now()
          where destinatario_id = ${sess.agenteId} and lida_em is null
            and id = any(${ids.map(Number).filter(Number.isFinite)}::bigint[])`
      : await sql`
          update notificacoes set lida_em = now()
          where destinatario_id = ${sess.agenteId} and lida_em is null`;
  return r.count;
}
