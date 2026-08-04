import { sql } from './db';
import { notificarUm } from './notificacoes';
import type { SessaoPortal } from './portal-auth';

/**
 * Seguidores de um ticket.
 *
 * REGRA — só entra quem pertence à MESMA agência da solicitação. Isso é
 * conferido no INSERT, contra `s.agencia_id`, e não na interface: um id
 * de outra organização não encontra linha e a operação falha. Não existe
 * digitação livre em lugar nenhum do caminho.
 *
 * EFEITO — seguir concede leitura do ticket (ver `escopo` em portal.ts) e
 * faz as notificações dele chegarem. É o mecanismo de colaboração entre
 * colegas da mesma agência.
 */

export interface Seguidor {
  agente_id: string;
  nome: string;
  email: string;
  admin: boolean;
  criado_em: string;
}

export async function listarSeguidores(solicitacaoId: string): Promise<Seguidor[]> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId)) return [];
  return sql<Seguidor[]>`
    select g.agente_id, a.nome, a.email::text, a.admin, g.criado_em
    from seguidores g
    join agentes a on a.id = g.agente_id
    where g.solicitacao_id = ${solicitacaoId}
    order by a.nome
  `;
}

/**
 * Colegas que podem ser adicionados: ativos, da mesma agência, que ainda
 * não seguem e que não são o próprio dono do card (ele já acompanha).
 */
export async function candidatosASeguidor(
  sess: SessaoPortal,
  solicitacaoId: string,
): Promise<{ id: string; nome: string; email: string }[]> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId)) return [];
  return sql<{ id: string; nome: string; email: string }[]>`
    select a.id, a.nome, a.email::text
    from agentes a
    join solicitacoes s on s.id = ${solicitacaoId}
    where a.agencia_id = s.agencia_id
      and a.agencia_id = ${sess.agenciaId}
      and a.ativo
      and a.id <> coalesce(s.agente_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and not exists (
        select 1 from seguidores g
        where g.solicitacao_id = s.id and g.agente_id = a.id
      )
    order by a.nome
  `;
}

export type ResultadoSeguidor =
  | { ok: true }
  | { ok: false; erro: string };

export async function adicionarSeguidor(
  sess: SessaoPortal,
  solicitacaoId: string,
  agenteId: string,
): Promise<ResultadoSeguidor> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId) || !/^[0-9a-f-]{36}$/i.test(agenteId)) {
    return { ok: false, erro: 'Identificador inválido.' };
  }

  // O insert só acontece se a solicitação for da agência da sessão E o
  // convidado pertencer a essa mesma agência. As duas condições vivem no
  // próprio SQL — não há caminho pela aplicação que as contorne.
  const inseridas = await sql`
    insert into seguidores (solicitacao_id, agente_id, criado_por)
    select s.id, a.id, ${sess.agenteId}
    from solicitacoes s
    join agentes a on a.id = ${agenteId} and a.ativo and a.agencia_id = s.agencia_id
    where s.id = ${solicitacaoId} and s.agencia_id = ${sess.agenciaId}
    on conflict do nothing
  `;

  if (inseridas.count === 0) {
    return { ok: false, erro: 'Não foi possível adicionar este seguidor.' };
  }

  const [s] = await sql<{ cliente_nome: string; protocolo: string }[]>`
    select cliente_nome, protocolo from solicitacoes where id = ${solicitacaoId}`;

  await notificarUm(
    agenteId,
    solicitacaoId,
    'seguidor_adicionado',
    `${sess.nome} adicionou você como seguidor`,
    `${s?.protocolo ?? ''} · ${s?.cliente_nome ?? ''}`,
  );

  return { ok: true };
}

export async function removerSeguidor(
  sess: SessaoPortal,
  solicitacaoId: string,
  agenteId: string,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(solicitacaoId) || !/^[0-9a-f-]{36}$/i.test(agenteId)) {
    return false;
  }
  const r = await sql`
    delete from seguidores g
    using solicitacoes s
    where g.solicitacao_id = s.id
      and g.solicitacao_id = ${solicitacaoId}
      and g.agente_id = ${agenteId}
      and s.agencia_id = ${sess.agenciaId}
  `;
  return r.count > 0;
}
