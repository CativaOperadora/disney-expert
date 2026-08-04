import { sql } from './db';
import { STATUS } from './sla';
import { formatarBRL } from './valores';
import type { SessaoPortal } from './portal-auth';

/**
 * Consultas do Portal, SEMPRE recortadas pela sessão.
 *
 * `escopo(sess)` é a única porta: agente vê apenas o próprio `agente_id`;
 * admin vê toda a `agencia_id` da sua organização. Nenhuma função aqui
 * aceita agência ou agente vindos da requisição — o recorte vem do banco,
 * via sessão. É o que garante o isolamento multi-tenant.
 */

export function escopo(sess: SessaoPortal) {
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
  consultora_nome: string | null;
  criado_em: string;
}

export async function listarSolicitacoes(
  sess: SessaoPortal,
  f: FiltroLista = {},
): Promise<LinhaSolicitacao[]> {
  const busca = f.busca?.trim();
  const linhas = await sql<Omit<LinhaSolicitacao, 'status_rotulo'>[]>`
    select s.id, s.protocolo, s.status, s.cliente_nome, s.data_prevista_texto,
           s.total_pessoas, s.valor_total_venda, a.nome as agente_nome,
           u.nome as consultora_nome, s.criado_em
    from solicitacoes s
    left join agentes a on a.id = s.agente_id
    left join usuarios u on u.id = s.responsavel_id
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

/**
 * Eventos que a agência pode ver.
 *
 * `comentario` está FORA desta lista de propósito. As anotações da
 * consultoria são internas da Cativa — chegam a tratar de margem,
 * negociação e perfil da própria agência. Elas nunca podem sair daqui.
 *
 * A regra vale nos dois sentidos: quando a agência ganhar anotações
 * próprias (Fase 2), elas também não devem alcançar o CRM interno. Por
 * isso o corte é por tipo de evento, e não por um filtro de texto — não
 * existe caminho em que um comentário atravesse a fronteira.
 */
const EVENTO_VISIVEL: Record<string, string> = {
  // A solicitação chegando: é o lead da própria agência, não uma ação da
  // consultoria. Único evento de origem externa que ela enxerga.
  criada: 'Solicitação recebida',
  // Rastro das ações da PRÓPRIA agência. Tipo próprio justamente para
  // nunca se confundir com as anotações internas da consultoria.
  venda_agencia: 'Dados da venda atualizados',
};

/**
 * Fora da lista, deliberadamente:
 *
 *   comentario ............. anotação interna da consultoria
 *   status_alterado ........ mudança de etapa feita pela especialista
 *   consultoria_registrada . andamento interno da consultoria
 *
 * A agência só acompanha o que ela mesma registrou. O andamento interno
 * da Cativa não é visível para ela — e o mesmo valerá no sentido oposto
 * quando a agência tiver anotações e etapas próprias (Fase 2).
 */

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
  // Sem tratamento especial por tipo: o rótulo vem só de EVENTO_VISIVEL.
  // Derivar texto do payload seria mais uma porta por onde detalhe interno
  // poderia escapar — o corte tem que ser o mais burro possível.
  return eventos.map((e) => ({
    tipo: e.tipo,
    rotulo: EVENTO_VISIVEL[e.tipo] ?? e.tipo,
    descricao: e.descricao,
    criado_em: e.criado_em,
  }));
}

// ======================================================= edição dos dados de venda

/**
 * Grava valor da venda / ID da reserva a partir do Portal.
 *
 * PERMISSÃO: reaproveita `escopo(sess)` no próprio UPDATE — admin alcança
 * qualquer solicitação da agência, agente só as que ele originou. Um id
 * fora do escopo não atualiza nada e devolve false (indistinguível de
 * inexistente, do ponto de vista do portal).
 *
 * NÃO altera `status` nem `venda_em`: a etapa do atendimento continua sendo
 * exclusividade do CRM interno da consultoria.
 */
export async function atualizarVendaPortal(
  sess: SessaoPortal,
  id: string,
  campo: 'valor_total_venda' | 'id_reserva',
  valor: number | string | null,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;

  const upd =
    campo === 'valor_total_venda'
      ? await sql`
          update solicitacoes s set valor_total_venda = ${valor as number | null}
          where s.id = ${id} and ${escopo(sess)} and s.status <> 'duplicada'`
      : await sql`
          update solicitacoes s set id_reserva = ${valor as string | null}
          where s.id = ${id} and ${escopo(sess)} and s.status <> 'duplicada'`;

  if (upd.count === 0) return false;

  // Rastro na linha do tempo: o número alimenta o faturamento do BI, então
  // quem mudou e para quanto precisa ficar registrado.
  const descricao =
    campo === 'valor_total_venda'
      ? `${sess.nome} (${sess.agenciaNome}) definiu o valor da venda: ${
          valor == null ? 'em branco' : `R$ ${formatarBRL(Number(valor))}`
        }`
      : `${sess.nome} (${sess.agenciaNome}) definiu o ID da reserva: ${valor || 'em branco'}`;

  await sql`
    insert into eventos (solicitacao_id, tipo, descricao, payload)
    values (${id}, 'venda_agencia', ${descricao},
            ${sql.json({ origem: 'portal', campo, agente_id: sess.agenteId })})
  `;
  return true;
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
