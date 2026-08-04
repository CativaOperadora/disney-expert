import { sql } from './db';
import type { SessaoPortal } from './portal-auth';

/**
 * Central de Notificações — Portal e equipe interna.
 *
 * FRONTEIRA — nenhum evento do ANDAMENTO da consultoria vira notificação
 * de agente. Avisar a agência de que a especialista mudou de etapa exporia
 * o interno pela porta dos fundos, justamente o que a separação de
 * pipelines existe para impedir. Todo gatilho do lado do Portal nasce de
 * uma ação da agência, ou da chegada de um lead (que é dela).
 *
 * A partir da migração 016 a mesma tabela atende os dois públicos, em
 * colunas distintas: `destinatario_id` (agentes) e
 * `destinatario_usuario_id` (equipe interna). As funções do Portal filtram
 * pela primeira, as internas pela segunda. Como toda linha interna tem
 * `destinatario_id` NULO, e NULL não casa com id nenhum, não existe filtro
 * esquecido capaz de entregar aviso interno para agência — a separação é
 * estrutural, não uma convenção que alguém precise lembrar.
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

/** Tipos endereçados à equipe interna. Separados de propósito: um não é aceito no lugar do outro. */
export type TipoNotificacaoInterna = 'solicitacao_nova_interna';

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

/**
 * Avisa TODAS as especialistas ativas — a caixa é compartilhada de fato.
 *
 * Uma solicitação recém-chegada não tem responsável: `criarCards()` grava
 * o card da consultoria com `responsavel_id` nulo, e a atribuição é um
 * gesto humano no quadro. Endereçar "à responsável" não teria a quem, e
 * sortear uma dona no automático faria o lead esperar por quem talvez
 * esteja de folga. Então as duas ficam sabendo, e quem pegar assume.
 *
 * Não recebe `autor`: quem preenche o formulário é o cliente final, nunca
 * alguém da casa. Não há de quem se descontar.
 */
export async function notificarEspecialistas(
  solicitacaoId: string,
  tipo: TipoNotificacaoInterna,
  titulo: string,
  descricao: string | null,
): Promise<number> {
  const r = await sql`
    insert into notificacoes
      (destinatario_usuario_id, solicitacao_id, tipo, titulo, descricao)
    select u.id, ${solicitacaoId}, ${tipo}, ${titulo}, ${descricao}
    from usuarios u
    where u.papel = 'especialista' and u.ativo
  `;
  return r.count;
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

// ---------------------------------------------------------------------
// CAIXA DA EQUIPE INTERNA
//
// Mesmas três operações do Portal, filtrando pela outra coluna. O id vem
// sempre da sessão do CRM (`sessaoPainel().usuarioId`), nunca da
// requisição — ninguém lê nem marca a caixa de outra pessoa.
//
// Quem entrou pela senha de emergência tem `usuarioId` nulo e portanto
// não tem caixa: a rota barra antes de chegar aqui.
// ---------------------------------------------------------------------

export async function listarNotificacoesInternas(
  usuarioId: string,
  limite = 30,
): Promise<Notificacao[]> {
  return sql<Notificacao[]>`
    select id::text, tipo, titulo, descricao, solicitacao_id, lida_em, criado_em
    from notificacoes
    where destinatario_usuario_id = ${usuarioId}
    order by criado_em desc
    limit ${limite}
  `;
}

export async function contarNaoLidasInternas(usuarioId: string): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int n from notificacoes
    where destinatario_usuario_id = ${usuarioId} and lida_em is null
  `;
  return r?.n ?? 0;
}

export async function marcarLidasInternas(
  usuarioId: string,
  ids?: string[],
): Promise<number> {
  const r =
    ids && ids.length > 0
      ? await sql`
          update notificacoes set lida_em = now()
          where destinatario_usuario_id = ${usuarioId} and lida_em is null
            and id = any(${ids.map(Number).filter(Number.isFinite)}::bigint[])`
      : await sql`
          update notificacoes set lida_em = now()
          where destinatario_usuario_id = ${usuarioId} and lida_em is null`;
  return r.count;
}
