import { sql } from './db';
import { STATUS } from './sla';
import { buscarPergunta } from './perguntas';
import type { Lado } from './cards';

/**
 * Camada de dados do módulo de BI.
 *
 * Cada indicador é uma consulta agregada sobre `solicitacoes`, sempre
 * recortada pelos mesmos filtros. Os filtros de dimensão (agência, agente,
 * consultora, cidade, parque) valem para tudo; o filtro de período incide
 * na coluna de data que faz sentido para cada métrica:
 *
 *   - solicitações recebidas ......... criado_em
 *   - consultorias / tempo de resposta primeiro_atendimento_em
 *   - vendas / faturamento ........... venda_em
 *
 * Assim "faturamento no mês" conta a venda pelo dia em que ela fechou, não
 * pelo dia em que a solicitação chegou.
 */

export interface Filtros {
  de: string | null; // YYYY-MM-DD, inclusivo
  ate: string | null; // YYYY-MM-DD, inclusivo
  agencia: string | null;
  agente: string | null;
  consultora: string | null;
  status: string | null;
  cidade: string | null;
  parque: string | null;
  granularidade: 'dia' | 'semana' | 'mes' | 'ano';
  /**
   * De qual pipeline sair os números.
   *
   * Este módulo serve DOIS dashboards: o BI interno da Cativa e o do
   * Portal da agência. Cada um soma o próprio card — a agência ajusta a
   * comissão dela, então os totais divergem por natureza. Errar este
   * campo faz um lado ver o faturamento do outro, que é justamente o que
   * a separação existe para impedir.
   */
  lado: Lado;
}

export const FILTROS_VAZIOS: Filtros = {
  de: null,
  ate: null,
  agencia: null,
  agente: null,
  consultora: null,
  status: null,
  cidade: null,
  parque: null,
  granularidade: 'mes',
  lado: 'consultoria',
};

/** Junta o card do lado pedido nos filtros. */
const cardDe = (f: Filtros) =>
  sql`join cards c on c.solicitacao_id = s.id and c.lado = ${f.lado}::lado_card`;

const GRAN_PG: Record<Filtros['granularidade'], string> = {
  dia: 'day',
  semana: 'week',
  mes: 'month',
  ano: 'year',
};

/** Filtros de dimensão, sem período e sem status. Válidos em toda consulta. */
function dim(f: Filtros) {
  return sql`
    ${f.agencia ? sql`and s.agencia_id = ${f.agencia}` : sql``}
    ${f.agente ? sql`and s.agente_id = ${f.agente}` : sql``}
    ${f.consultora ? sql`and c.responsavel_id = ${f.consultora}` : sql``}
    ${f.cidade ? sql`and s.origem_embarque = ${f.cidade}` : sql``}
    ${f.parque ? sql`and s.parques @> array[${f.parque}]::text[]` : sql``}
  `;
}

/** Recorte de status, aplicado só às métricas de solicitação. */
function statusDim(f: Filtros) {
  return f.status
    ? sql`and c.status = ${f.status}::status_solicitacao`
    : sql``;
}

/** Recorte de período sobre uma coluna de data qualquer. */
function periodo(coluna: any, de: string | null, ate: string | null) {
  return sql`
    ${de ? sql`and ${coluna} >= ${de}::date` : sql``}
    ${ate ? sql`and ${coluna} < (${ate}::date + 1)` : sql``}
  `;
}

const num = (v: any) => (v == null ? 0 : Number(v));

// ===================================================================== KPIs

export interface Kpis {
  solicitacoes: number;
  consultorias: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  passageiros: number;
  taxaConversao: number; // 0..1
  segSolicConsultoria: number | null;
  segConsultoriaVenda: number | null;
  segTotal: number | null;
}

async function kpis(
  f: Filtros,
  de: string | null,
  ate: string | null,
): Promise<Kpis> {
  const [rec, cons, ven] = await Promise.all([
    sql<{ n: number }[]>`
      select count(*)::int n from solicitacoes s
      ${cardDe(f)}
      where true ${periodo(sql`s.criado_em`, de, ate)} ${dim(f)} ${statusDim(f)}`,
    sql<{ n: number; seg: number | null }[]>`
      select count(*)::int n,
             avg(extract(epoch from (c.primeiro_atendimento_em - s.criado_em))) seg
      from solicitacoes s
      ${cardDe(f)}
      where c.primeiro_atendimento_em is not null
        ${periodo(sql`c.primeiro_atendimento_em`, de, ate)} ${dim(f)}`,
    sql<
      {
        n: number;
        valor: string;
        pax: number;
        seg_cv: number | null;
        seg_total: number | null;
      }[]
    >`
      select count(*)::int n,
             coalesce(sum(c.valor_total_venda), 0) valor,
             coalesce(sum(s.total_pessoas), 0)::int pax,
             avg(extract(epoch from (c.venda_em - c.primeiro_atendimento_em))) seg_cv,
             avg(extract(epoch from (c.venda_em - s.criado_em))) seg_total
      from solicitacoes s
      ${cardDe(f)}
      where c.status = 'venda_finalizada' and c.venda_em is not null
        ${periodo(sql`c.venda_em`, de, ate)} ${dim(f)}`,
  ]);

  const solicitacoes = rec[0].n;
  const vendas = ven[0].n;
  const faturamento = num(ven[0].valor);

  return {
    solicitacoes,
    consultorias: cons[0].n,
    vendas,
    faturamento,
    ticketMedio: vendas > 0 ? faturamento / vendas : 0,
    passageiros: ven[0].pax,
    taxaConversao: solicitacoes > 0 ? vendas / solicitacoes : 0,
    segSolicConsultoria: cons[0].seg == null ? null : Number(cons[0].seg),
    segConsultoriaVenda: ven[0].seg_cv == null ? null : Number(ven[0].seg_cv),
    segTotal: ven[0].seg_total == null ? null : Number(ven[0].seg_total),
  };
}

/** Janela imediatamente anterior, de mesmo tamanho, para o comparativo. */
function janelaAnterior(
  de: string | null,
  ate: string | null,
): { de: string | null; ate: string | null } {
  if (!de || !ate) return { de: null, ate: null };
  const d1 = new Date(de + 'T00:00:00Z');
  const d2 = new Date(ate + 'T00:00:00Z');
  const dias = Math.round((+d2 - +d1) / 86_400_000) + 1;
  const prevAte = new Date(d1);
  prevAte.setUTCDate(prevAte.getUTCDate() - 1);
  const prevDe = new Date(prevAte);
  prevDe.setUTCDate(prevDe.getUTCDate() - (dias - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { de: iso(prevDe), ate: iso(prevAte) };
}

// =============================================================== séries e listas

export interface PontoTempo {
  bucket: string;
  solicitacoes: number;
  vendas: number;
  faturamento: number;
}

async function evolucao(f: Filtros): Promise<PontoTempo[]> {
  const g = GRAN_PG[f.granularidade];
  const [sol, ven] = await Promise.all([
    sql<{ bucket: string; n: number }[]>`
      select to_char(date_trunc(${g}, s.criado_em), 'YYYY-MM-DD') bucket, count(*)::int n
      from solicitacoes s
      ${cardDe(f)}
      where true ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)} ${statusDim(f)}
      group by 1 order by 1`,
    sql<{ bucket: string; n: number; valor: string }[]>`
      select to_char(date_trunc(${g}, c.venda_em), 'YYYY-MM-DD') bucket,
             count(*)::int n, coalesce(sum(c.valor_total_venda), 0) valor
      from solicitacoes s
      ${cardDe(f)}
      where c.status = 'venda_finalizada' and c.venda_em is not null
        ${periodo(sql`c.venda_em`, f.de, f.ate)} ${dim(f)}
      group by 1 order by 1`,
  ]);

  const mapa = new Map<string, PontoTempo>();
  for (const r of sol)
    mapa.set(r.bucket, {
      bucket: r.bucket,
      solicitacoes: r.n,
      vendas: 0,
      faturamento: 0,
    });
  for (const r of ven) {
    const p =
      mapa.get(r.bucket) ??
      { bucket: r.bucket, solicitacoes: 0, vendas: 0, faturamento: 0 };
    p.vendas = r.n;
    p.faturamento = num(r.valor);
    mapa.set(r.bucket, p);
  }
  return [...mapa.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export interface ItemRanking {
  id: string;
  rotulo: string;
  sub?: string;
  n: number;
  valor?: number;
}

async function rankings(f: Filtros) {
  const [agencias, agentes, consAtend, consVendas] = await Promise.all([
    sql<{ id: string; rotulo: string; n: number; valor: string }[]>`
      select ag.id, ag.nome rotulo, count(*)::int n, coalesce(sum(c.valor_total_venda),0) valor
      from solicitacoes s
      ${cardDe(f)}
      join agencias ag on ag.id = s.agencia_id
      where c.status = 'venda_finalizada' and c.venda_em is not null
        ${periodo(sql`c.venda_em`, f.de, f.ate)} ${dim(f)}
      group by ag.id, ag.nome order by valor desc, n desc limit 10`,
    sql<{ id: string; rotulo: string; sub: string; n: number }[]>`
      select a.id, a.nome rotulo, coalesce(ag.nome,'—') sub, count(*)::int n
      from solicitacoes s
      ${cardDe(f)}
      join agentes a on a.id = s.agente_id
      left join agencias ag on ag.id = s.agencia_id
      where true ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)} ${statusDim(f)}
      group by a.id, a.nome, ag.nome order by n desc limit 10`,
    sql<{ id: string; rotulo: string; n: number }[]>`
      select u.id, u.nome rotulo, count(*)::int n
      from solicitacoes s
      ${cardDe(f)}
      join usuarios u on u.id = c.responsavel_id
      where c.primeiro_atendimento_em is not null
        ${periodo(sql`c.primeiro_atendimento_em`, f.de, f.ate)} ${dim(f)}
      group by u.id, u.nome order by n desc limit 10`,
    sql<{ id: string; rotulo: string; n: number; valor: string }[]>`
      select u.id, u.nome rotulo, count(*)::int n, coalesce(sum(c.valor_total_venda),0) valor
      from solicitacoes s
      ${cardDe(f)}
      join usuarios u on u.id = c.responsavel_id
      where c.status = 'venda_finalizada' and c.venda_em is not null
        ${periodo(sql`c.venda_em`, f.de, f.ate)} ${dim(f)}
      group by u.id, u.nome order by valor desc, n desc limit 10`,
  ]);

  return {
    agencias: agencias.map((r) => ({ ...r, valor: num(r.valor) })) as ItemRanking[],
    agentes: agentes as ItemRanking[],
    consultorasAtendimentos: consAtend as ItemRanking[],
    consultorasVendas: consVendas.map((r) => ({
      ...r,
      valor: num(r.valor),
    })) as ItemRanking[],
  };
}

export interface Fatia {
  rotulo: string;
  n: number;
}

/** Distribuição por uma expressão do formulário (coluna ou chave do JSONB). */
async function distribuicaoJson(f: Filtros, chave: string): Promise<Fatia[]> {
  return sql<Fatia[]>`
    select s.respostas->>${chave} rotulo, count(*)::int n
    from solicitacoes s
      ${cardDe(f)}
    where s.respostas->>${chave} is not null and s.respostas->>${chave} <> ''
      ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)} ${statusDim(f)}
    group by 1 order by n desc`;
}

async function distribuicoes(f: Filtros) {
  const [
    parques,
    cidades,
    hospedagem,
    perfilHotel,
    interesseComplexo,
    primeiraViagem,
    locomocao,
    porStatus,
  ] = await Promise.all([
    sql<Fatia[]>`
      select p rotulo, count(*)::int n
      from solicitacoes s
      ${cardDe(f)},
           unnest(s.parques) p
      where true ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)} ${statusDim(f)}
      group by p order by n desc limit 12`,
    sql<Fatia[]>`
      select s.origem_embarque rotulo, count(*)::int n
      from solicitacoes s
      ${cardDe(f)}
      where s.origem_embarque is not null and s.origem_embarque <> ''
        ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)} ${statusDim(f)}
      group by 1 order by n desc limit 12`,
    distribuicaoJson(f, 'estilo_hospedagem'),
    distribuicaoJson(f, 'perfil_hotel'),
    distribuicaoJson(f, 'hoteis_dentro_complexo'),
    distribuicaoJson(f, 'primeira_viagem'),
    distribuicaoJson(f, 'locomocao'),
    sql<{ status: string; n: number }[]>`
      select c.status, count(*)::int n
      from solicitacoes s
      ${cardDe(f)}
      where true ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)}
      group by c.status`,
  ]);

  const rotuloStatus: Record<string, string> = Object.fromEntries(
    STATUS.map((s) => [s.id, s.titulo]),
  );

  return {
    parques,
    cidades,
    hospedagem,
    perfilHotel,
    interesseComplexo,
    primeiraViagem,
    locomocao,
    porStatus: porStatus.map((r) => ({
      rotulo: rotuloStatus[r.status] ?? r.status,
      chave: r.status,
      n: r.n,
    })),
  };
}

// ============================================================ desempenho por agente

export interface DesempenhoAgente {
  id: string;
  nome: string;
  solicitacoes: number;
  vendas: number;
  faturamento: number;
}

/**
 * Comparativo por agente (uso do admin da agência). O recorte de agência
 * vem em `f.agencia` (forçado pela sessão do portal), então nunca vaza
 * agentes de outra organização.
 */
export async function desempenhoPorAgente(f: Filtros): Promise<DesempenhoAgente[]> {
  const rows = await sql<
    { id: string; nome: string; solicitacoes: number; vendas: number; faturamento: string }[]
  >`
    select a.id, a.nome,
           count(s.id)::int as solicitacoes,
           count(s.id) filter (where c.status = 'venda_finalizada')::int as vendas,
           coalesce(sum(c.valor_total_venda) filter (where c.status = 'venda_finalizada'), 0) as faturamento
    from agentes a
    join solicitacoes s on s.agente_id = a.id
    ${cardDe(f)}
      and c.status <> 'duplicada'
    where true ${periodo(sql`s.criado_em`, f.de, f.ate)} ${dim(f)}
    group by a.id, a.nome
    order by faturamento desc, solicitacoes desc
    limit 100
  `;
  return rows.map((r) => ({ ...r, faturamento: num(r.faturamento) }));
}

// ================================================================ opções de filtro

export interface OpcoesFiltro {
  agencias: { id: string; nome: string }[];
  agentes: { id: string; nome: string }[];
  consultoras: { id: string; nome: string }[];
  cidades: string[];
  parques: string[];
  status: { id: string; titulo: string }[];
}

export async function opcoesFiltro(): Promise<OpcoesFiltro> {
  const [agencias, agentes, consultoras, cidades] = await Promise.all([
    sql<{ id: string; nome: string }[]>`select id, nome from agencias order by nome`,
    sql<{ id: string; nome: string }[]>`select id, nome from agentes where ativo order by nome`,
    sql<{ id: string; nome: string }[]>`select id, nome from usuarios where ativo order by nome`,
    sql<{ origem_embarque: string }[]>`
      select distinct origem_embarque from solicitacoes
      where origem_embarque is not null and origem_embarque <> ''
      order by origem_embarque limit 300`,
  ]);
  const parques = (buscarPergunta('parques')?.opcoes ?? []).filter(
    (o) => !o.toLowerCase().startsWith('ainda não'),
  );
  return {
    agencias,
    agentes,
    consultoras,
    cidades: cidades.map((c) => c.origem_embarque),
    parques,
    status: STATUS.map((s) => ({ id: s.id, titulo: s.titulo })),
  };
}

// ================================================================ orquestrador

export interface DadosDashboard {
  atual: Kpis;
  anterior: Kpis | null;
  temComparativo: boolean;
  evolucao: PontoTempo[];
  rankings: Awaited<ReturnType<typeof rankings>>;
  distribuicoes: Awaited<ReturnType<typeof distribuicoes>>;
}

export async function carregarDashboard(f: Filtros): Promise<DadosDashboard> {
  const prev = janelaAnterior(f.de, f.ate);
  const [atual, anterior, evo, rk, dist] = await Promise.all([
    kpis(f, f.de, f.ate),
    prev.de ? kpis(f, prev.de, prev.ate) : Promise.resolve(null),
    evolucao(f),
    rankings(f),
    distribuicoes(f),
  ]);

  return {
    atual,
    anterior,
    temComparativo: !!prev.de,
    evolucao: evo,
    rankings: rk,
    distribuicoes: dist,
  };
}
