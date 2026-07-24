import { sql } from './db';
import { STATUS } from './sla';
import type { SessaoPortal } from './portal-auth';

/**
 * Consultas do Portal, SEMPRE recortadas pela sessão.
 *
 * `escopo(sess)` é a única porta: agente vê apenas o próprio `agente_id`;
 * admin vê toda a `agencia_id` da sua organização. Nenhuma função aqui
 * aceita agência ou agente vindos da requisição — o recorte vem do banco,
 * via sessão. É o que garante o isolamento multi-tenant.
 */

function escopo(sess: SessaoPortal) {
  return sess.admin
    ? sql`s.agencia_id = ${sess.agenciaId}`
    : sql`s.agente_id = ${sess.agenteId}`;
}

const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  STATUS.map((s) => [s.id, s.titulo]),
);

export interface FiltroLista {
  busca?: string | null;
  status?: string | null;
  de?: string | null;
  ate?: string | null;
}

export interface LinhaSolicitacao {
  id: string;
  protocolo: string;
  status: string;
  status_rotulo: string;
  cliente_nome: string;
  data_prevista_texto: string | null;
  total_pessoas: number | null;
  valor_total_venda: string | null;
  agente_nome: string | null;
  criado_em: string;
}

export async function listarSolicitacoes(
  sess: SessaoPortal,
  f: FiltroLista = {},
): Promise<LinhaSolicitacao[]> {
  const busca = f.busca?.trim();
  const linhas = await sql<Omit<LinhaSolicitacao, 'status_rotulo'>[]>`
    select s.id, s.protocolo, s.status, s.cliente_nome, s.data_prevista_texto,
           s.total_pessoas, s.valor_total_venda, a.nome as agente_nome, s.criado_em
    from solicitacoes s
    left join agentes a on a.id = s.agente_id
    where ${escopo(sess)}
      and s.status <> 'duplicada'
      ${f.status ? sql`and s.status = ${f.status}::status_solicitacao` : sql``}
      ${busca ? sql`and (s.cliente_nome ilike ${'%' + busca + '%'} or s.protocolo ilike ${'%' + busca + '%'})` : sql``}
      ${f.de ? sql`and s.criado_em >= ${f.de}::date` : sql``}
      ${f.ate ? sql`and s.criado_em < (${f.ate}::date + 1)` : sql``}
    order by s.criado_em desc
    limit 500
  `;
  return linhas.map((l) => ({ ...l, status_rotulo: ROTULO_STATUS[l.status] ?? l.status }));
}

export interface DetalhePortal {
  id: string;
  protocolo: string;
  status: string;
  status_rotulo: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_whatsapp: string;
  data_prevista_texto: string | null;
  total_pessoas: number | null;
  total_criancas: number | null;
  origem_embarque: string | null;
  valor_total_venda: string | null;
  id_reserva: string | null;
  venda_em: string | null;
  motivo_perda: string | null;
  agente_nome: string | null;
  respostas: Record<string, any>;
  criado_em: string;
}

/** Detalhe apenas se estiver dentro do escopo. Fora do escopo devolve null. */
export async function detalheSolicitacao(
  sess: SessaoPortal,
  id: string,
): Promise<DetalhePortal | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [s] = await sql<Omit<DetalhePortal, 'status_rotulo'>[]>`
    select s.id, s.protocolo, s.status, s.cliente_nome, s.cliente_email,
           s.cliente_whatsapp, s.data_prevista_texto, s.total_pessoas,
           s.total_criancas, s.origem_embarque, s.valor_total_venda,
           s.id_reserva, s.venda_em, s.motivo_perda,
           a.nome as agente_nome, s.respostas, s.criado_em
    from solicitacoes s
    left join agentes a on a.id = s.agente_id
    where s.id = ${id} and ${escopo(sess)}
    limit 1
  `;
  if (!s) return null;
  return { ...s, status_rotulo: ROTULO_STATUS[s.status] ?? s.status };
}

export interface EventoPortal {
  tipo: string;
  rotulo: string;
  descricao: string | null;
  criado_em: string;
}

const EVENTO_VISIVEL: Record<string, string> = {
  criada: 'Solicitação recebida',
  status_alterado: 'Situação atualizada',
  comentario: 'Atualização da consultoria',
  consultoria_registrada: 'Consultoria registrada',
};

/** Timeline curada para o agente. Só chame após validar o acesso ao id. */
export async function timelineSolicitacao(id: string): Promise<EventoPortal[]> {
  const eventos = await sql<
    { tipo: string; descricao: string | null; payload: any; criado_em: string }[]
  >`
    select tipo, descricao, payload, criado_em
    from eventos
    where solicitacao_id = ${id} and tipo = any(${Object.keys(EVENTO_VISIVEL)})
    order by criado_em asc
  `;
  return eventos.map((e) => {
    let rotulo = EVENTO_VISIVEL[e.tipo] ?? e.tipo;
    if (e.tipo === 'status_alterado' && e.payload?.para) {
      rotulo = `Situação: ${ROTULO_STATUS[e.payload.para] ?? e.payload.para}`;
    }
    return { tipo: e.tipo, rotulo, descricao: e.descricao, criado_em: e.criado_em };
  });
}

// =================================================== gestão de usuários (admin)

export interface UsuarioAgencia {
  id: string;
  nome: string;
  email: string;
  codigo: string;
  admin: boolean;
  ativo: boolean;
  ultimo_acesso: string | null;
  solicitacoes: number;
}

export async function listarUsuarios(sess: SessaoPortal): Promise<UsuarioAgencia[]> {
  if (!sess.admin) return [];
  return sql<UsuarioAgencia[]>`
    select a.id, a.nome, a.email, a.codigo, a.admin, a.ativo, a.ultimo_acesso,
           (select count(*)::int from solicitacoes s where s.agente_id = a.id) as solicitacoes
    from agentes a
    where a.agencia_id = ${sess.agenciaId}
    order by a.admin desc, a.nome
  `;
}
