import { sql } from './db';
import { STATUS } from './sla';
import { escopo } from './portal';
import { juntarCard } from './cards';
import type { SessaoPortal } from './portal-auth';

/**
 * Base de Leads do Portal — a mesma solicitação vista de outro ângulo.
 *
 * O Kanban é orientado a ATENDIMENTO: uma linha por solicitação. Aqui a
 * unidade é a PESSOA: agrupamos por `cliente_email`, então quem pediu
 * orçamento três vezes aparece uma vez só, com o histórico consolidado.
 * É o formato que serve para relacionamento e campanha, e evita disparar
 * o mesmo e-mail três vezes para o mesmo contato.
 *
 * ISOLAMENTO: reaproveita `escopo(sess)` de portal.ts — agente enxerga
 * apenas os leads que ele mesmo captou; admin, os da agência inteira.
 * Nenhum recorte vem da requisição.
 */

const ROTULO_STATUS: Record<string, string> = Object.fromEntries(
  STATUS.map((s) => [s.id, s.titulo]),
);

export interface FiltroLeads {
  busca?: string | null;
  status?: string | null;
  de?: string | null;
  ate?: string | null;
  /** true = apenas quem deu opt-in de marketing (os elegíveis a campanha). */
  somenteMarketing?: boolean;
}

export interface Lead {
  email: string;
  nome: string;
  whatsapp: string | null;
  cidade: string | null;
  periodo: string | null;
  parques: string | null;
  primeira_viagem: boolean | null;
  total_pessoas: number | null;
  ultimo_status: string;
  ultimo_status_rotulo: string;
  agente_nome: string | null;
  solicitacoes: number;
  vendas: number;
  faturamento: number;
  marketing: boolean;
  marketing_em: string | null;
  primeiro_em: string;
  ultimo_em: string;
}

/**
 * O período filtra QUAIS solicitações entram na consolidação — então os
 * contadores refletem exatamente a janela escolhida. O filtro de situação,
 * por outro lado, incide sobre a situação ATUAL do lead (via having), e
 * não sobre "teve alguma solicitação nesse status" — do contrário um lead
 * ganho no ano passado apareceria como se ainda estivesse em aberto.
 */
export async function listarLeads(
  sess: SessaoPortal,
  f: FiltroLeads = {},
  limite = 2000,
): Promise<Lead[]> {
  const busca = f.busca?.trim();

  const linhas = await sql<Omit<Lead, 'ultimo_status_rotulo'>[]>`
    select
      s.cliente_email::text                                                as email,
      (array_agg(s.cliente_nome            order by s.criado_em desc))[1]  as nome,
      (array_agg(s.cliente_whatsapp        order by s.criado_em desc))[1]  as whatsapp,
      (array_agg(s.origem_embarque         order by s.criado_em desc))[1]  as cidade,
      (array_agg(s.data_prevista_texto     order by s.criado_em desc))[1]  as periodo,
      (array_agg(array_to_string(s.parques, ' | ')
                                           order by s.criado_em desc))[1]  as parques,
      (array_agg(s.primeira_viagem         order by s.criado_em desc))[1]  as primeira_viagem,
      (array_agg(s.total_pessoas           order by s.criado_em desc))[1]  as total_pessoas,
      (array_agg(c.status::text            order by s.criado_em desc))[1]  as ultimo_status,
      (array_agg(a.nome                    order by s.criado_em desc))[1]  as agente_nome,
      count(*)::int                                                        as solicitacoes,
      count(*) filter (where c.status = 'venda_finalizada')::int           as vendas,
      coalesce(sum(c.valor_total_venda)
               filter (where c.status = 'venda_finalizada'), 0)            as faturamento,
      bool_or(s.aceite_marketing)                                          as marketing,
      max(s.aceite_marketing_em)                                           as marketing_em,
      min(s.criado_em)                                                     as primeiro_em,
      max(s.criado_em)                                                     as ultimo_em
    from solicitacoes s
    ${juntarCard('agencia')}
    left join agentes a on a.id = s.agente_id
    where ${escopo(sess)}
      and c.status <> 'duplicada'
      and s.cliente_email is not null
      ${f.de ? sql`and s.criado_em >= ${f.de}::date` : sql``}
      ${f.ate ? sql`and s.criado_em < (${f.ate}::date + 1)` : sql``}
      ${busca
        ? sql`and (s.cliente_nome ilike ${'%' + busca + '%'}
                or s.cliente_email::text ilike ${'%' + busca + '%'}
                or s.cliente_whatsapp ilike ${'%' + busca + '%'})`
        : sql``}
    group by s.cliente_email
    having true
      ${f.somenteMarketing ? sql`and bool_or(s.aceite_marketing)` : sql``}
      ${f.status
        ? sql`and (array_agg(c.status::text order by s.criado_em desc))[1] = ${f.status}`
        : sql``}
    order by max(s.criado_em) desc
    limit ${limite}
  `;

  return linhas.map((l) => ({
    ...l,
    faturamento: Number(l.faturamento ?? 0),
    ultimo_status_rotulo: ROTULO_STATUS[l.ultimo_status] ?? l.ultimo_status,
  }));
}

export interface ResumoLeads {
  total: number;
  aptosCampanha: number;
  comVenda: number;
  recorrentes: number;
}

export function resumirLeads(leads: Lead[]): ResumoLeads {
  return {
    total: leads.length,
    aptosCampanha: leads.filter((l) => l.marketing).length,
    comVenda: leads.filter((l) => l.vendas > 0).length,
    recorrentes: leads.filter((l) => l.solicitacoes > 1).length,
  };
}
