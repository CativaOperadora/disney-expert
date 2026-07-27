import Link from 'next/link';
import {
  carregarDashboard,
  opcoesFiltro,
  FILTROS_VAZIOS,
  type Filtros as TFiltros,
  type Kpis,
} from '@/lib/bi';
import Filtros from './Filtros';
import {
  KpiCard,
  BarrasH,
  Rosca,
  LinhaEvolucao,
  BarrasFaturamento,
  TabelaRanking,
  fmtInt,
  fmtReais,
  fmtPct,
  fmtDuracao,
  AZUL,
  CATEGORICA,
} from './Graficos';

export const dynamic = 'force-dynamic';

const GRANS = ['dia', 'semana', 'mes', 'ano'] as const;

function texto(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : null;
}
function data(v: string | string[] | undefined): string | null {
  const s = texto(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Variação relativa entre atual e anterior (para os deltas dos KPIs). */
function delta(atual: number, anterior: number | undefined): number | null {
  if (anterior == null || anterior === 0) return null;
  return (atual - anterior) / anterior;
}

export default async function Dashboards({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const granBruto = texto(sp.gran);
  const filtros: TFiltros = {
    ...FILTROS_VAZIOS,
    de: data(sp.de),
    ate: data(sp.ate),
    agencia: texto(sp.agencia),
    agente: texto(sp.agente),
    consultora: texto(sp.consultora),
    status: texto(sp.status),
    cidade: texto(sp.cidade),
    parque: texto(sp.parque),
    granularidade: (GRANS as readonly string[]).includes(granBruto ?? '')
      ? (granBruto as TFiltros['granularidade'])
      : 'mes',
  };

  const [dados, opcoes] = await Promise.all([
    carregarDashboard(filtros),
    opcoesFiltro(),
  ]);

  const { atual, anterior, temComparativo, evolucao, rankings, distribuicoes: dist } = dados;
  const a = anterior as Kpis | null;
  const d = (sel: (k: Kpis) => number) =>
    temComparativo && a ? delta(sel(atual), sel(a)) : null;

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <Link href="/painel" className="voltar-inline">← Fila</Link>
          <span className="marca-divisor" />
          <span className="marca-nome">Dashboards</span>
          <span className="marca-produto">Orlando Expert BI</span>
        </div>
        <Link href="/api/sair" className="sair" prefetch={false}>Sair</Link>
      </header>

      <main className="bi">
        <Filtros opcoes={opcoes} filtros={filtros} />

        {temComparativo && (
          <p className="bi-comparativo-nota">
            Variações comparadas ao período imediatamente anterior de mesma duração.
          </p>
        )}

        {/* ---- KPIs principais ---- */}
        <section className="kpi-grade">
          <KpiCard titulo="Solicitações recebidas" valor={fmtInt(atual.solicitacoes)} delta={d((k) => k.solicitacoes)} />
          <KpiCard titulo="Consultorias realizadas" valor={fmtInt(atual.consultorias)} delta={d((k) => k.consultorias)} />
          <KpiCard titulo="Vendas fechadas" valor={fmtInt(atual.vendas)} delta={d((k) => k.vendas)} destaque />
          <KpiCard titulo="Taxa de conversão" valor={fmtPct(atual.taxaConversao)} delta={d((k) => k.taxaConversao)} />
          <KpiCard titulo="Ticket médio" valor={fmtReais(atual.ticketMedio)} delta={d((k) => k.ticketMedio)} />
          <KpiCard titulo="Faturamento no período" valor={fmtReais(atual.faturamento)} delta={d((k) => k.faturamento)} destaque />
          <KpiCard titulo="Passageiros vendidos" valor={fmtInt(atual.passageiros)} delta={d((k) => k.passageiros)} />
        </section>

        {/* ---- Tempos médios ---- */}
        <section className="kpi-grade tempos">
          <KpiCard titulo="Tempo médio até a consultoria" valor={fmtDuracao(atual.segSolicConsultoria)} delta={d((k) => k.segSolicConsultoria ?? 0)} invertido />
          <KpiCard titulo="Tempo médio consultoria → venda" valor={fmtDuracao(atual.segConsultoriaVenda)} delta={d((k) => k.segConsultoriaVenda ?? 0)} invertido />
          <KpiCard titulo="Tempo médio total do atendimento" valor={fmtDuracao(atual.segTotal)} delta={d((k) => k.segTotal ?? 0)} invertido />
        </section>

        {/* ---- Evolução ---- */}
        <section className="bi-linha-2">
          <div className="cartao-bi grande">
            <h3 className="cartao-bi-titulo">Evolução de solicitações e vendas</h3>
            <LinhaEvolucao pontos={evolucao} gran={filtros.granularidade} />
          </div>
          <div className="cartao-bi grande">
            <h3 className="cartao-bi-titulo">Evolução do faturamento</h3>
            <BarrasFaturamento pontos={evolucao} gran={filtros.granularidade} />
          </div>
        </section>

        {/* ---- Rankings ---- */}
        <section className="bi-grade">
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Agências que mais compraram</h3>
            <TabelaRanking itens={rankings.agencias} colValor="Faturamento" rotuloN="Vendas" />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Agentes que mais solicitaram</h3>
            <TabelaRanking itens={rankings.agentes} rotuloN="Solicitações" />
          </div>
        </section>

        {/* ---- Perfil dos clientes ---- */}
        <section className="bi-grade">
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Distribuição por situação</h3>
            <Rosca fatias={dist.porStatus} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Primeira viagem para Orlando?</h3>
            <Rosca fatias={dist.primeiraViagem} cores={CATEGORICA} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Parques mais procurados</h3>
            <BarrasH itens={dist.parques} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Cidades de origem mais frequentes</h3>
            <BarrasH itens={dist.cidades} cor="#0ba7da" />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Estilo de hospedagem preferido</h3>
            <BarrasH itens={dist.hospedagem} cor={AZUL} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Perfil de hotel mais procurado</h3>
            <BarrasH itens={dist.perfilHotel} cor="#8a5cc7" />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Interesse em hotéis nos complexos</h3>
            <Rosca fatias={dist.interesseComplexo} cores={CATEGORICA} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Como pretendem se locomover</h3>
            <BarrasH itens={dist.locomocao} cor="#e0812f" />
          </div>
        </section>
      </main>
    </div>
  );
}
