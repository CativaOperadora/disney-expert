import { redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import { sql } from '@/lib/db';
import { carregarDashboard, desempenhoPorAgente, FILTROS_VAZIOS, type Filtros } from '@/lib/bi';
import { STATUS } from '@/lib/sla';
import PortalHeader from '../PortalHeader';
import {
  KpiCard, BarrasH, Rosca, LinhaEvolucao, BarrasFaturamento, TabelaRanking,
} from '../../painel/dashboards/Graficos';
import {
  fmtInt, fmtReais, fmtPct, fmtDuracao, AZUL, CATEGORICA,
} from '../../painel/dashboards/formato';

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

export default async function PortalDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');

  const sp = await searchParams;
  const gran = texto(sp.gran);

  // Agentes da própria agência (para o filtro do admin). Nunca expõe outras.
  const agentesAgencia = sess.admin
    ? await sql<{ id: string; nome: string }[]>`
        select id, nome from agentes where agencia_id = ${sess.agenciaId} and ativo order by nome`
    : [];
  const agenteSel =
    sess.admin && agentesAgencia.some((a) => a.id === texto(sp.agente)) ? texto(sp.agente) : null;

  // ISOLAMENTO: o recorte de agência/agente vem SEMPRE da sessão.
  const filtros: Filtros = {
    ...FILTROS_VAZIOS,
    // Números do pipeline DA AGÊNCIA. Divergir do BI da Cativa é
    // esperado: a agência ajusta a própria comissão.
    lado: 'agencia',
    de: data(sp.de),
    ate: data(sp.ate),
    status: texto(sp.status),
    granularidade: (GRANS as readonly string[]).includes(gran ?? '')
      ? (gran as Filtros['granularidade'])
      : 'mes',
    agencia: sess.admin ? sess.agenciaId : null,
    agente: sess.admin ? agenteSel : sess.agenteId,
  };

  const [dados, desempenho] = await Promise.all([
    carregarDashboard(filtros),
    sess.admin ? desempenhoPorAgente(filtros) : Promise.resolve([]),
  ]);
  const { atual, evolucao, rankings, distribuicoes: dist } = dados;

  return (
    <div className="tela">
      <PortalHeader sess={sess} ativo="dash" />

      <main className="bi">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">
              {sess.admin ? 'Dashboard da agência' : 'Meu dashboard'}
            </h1>
            <p className="portal-sub">
              {sess.admin ? sess.agenciaNome : `${sess.nome} · ${sess.agenciaNome}`}
            </p>
          </div>
        </div>

        <form className="portal-filtros" method="get">
          <input className="entrada" type="date" name="de" defaultValue={filtros.de ?? ''} aria-label="De" />
          <input className="entrada" type="date" name="ate" defaultValue={filtros.ate ?? ''} aria-label="Até" />
          <select className="entrada" name="gran" defaultValue={filtros.granularidade}>
            <option value="dia">Por dia</option>
            <option value="semana">Por semana</option>
            <option value="mes">Por mês</option>
            <option value="ano">Por ano</option>
          </select>
          <select className="entrada" name="status" defaultValue={filtros.status ?? ''}>
            <option value="">Todas as situações</option>
            {STATUS.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </select>
          {sess.admin && (
            <select className="entrada" name="agente" defaultValue={agenteSel ?? ''}>
              <option value="">Todos os agentes</option>
              {agentesAgencia.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          )}
          <button className="botao botao-voltar" type="submit">Aplicar</button>
        </form>

        <section className="kpi-grade">
          <KpiCard titulo="Solicitações" valor={fmtInt(atual.solicitacoes)} />
          <KpiCard titulo="Em consultoria/atendidas" valor={fmtInt(atual.consultorias)} />
          <KpiCard titulo="Vendas fechadas" valor={fmtInt(atual.vendas)} destaque />
          <KpiCard titulo="Taxa de conversão" valor={fmtPct(atual.taxaConversao)} />
          <KpiCard titulo="Ticket médio" valor={fmtReais(atual.ticketMedio)} />
          <KpiCard titulo="Faturamento" valor={fmtReais(atual.faturamento)} destaque />
          <KpiCard titulo="Passageiros vendidos" valor={fmtInt(atual.passageiros)} />
        </section>

        <section className="kpi-grade tempos">
          <KpiCard titulo="Tempo médio até a consultoria" valor={fmtDuracao(atual.segSolicConsultoria)} />
          <KpiCard titulo="Tempo médio consultoria → venda" valor={fmtDuracao(atual.segConsultoriaVenda)} />
          <KpiCard titulo="Tempo médio total" valor={fmtDuracao(atual.segTotal)} />
        </section>

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

        {sess.admin && desempenho.length > 0 && (
          <section className="cartao-bi" style={{ marginBottom: 16 }}>
            <h3 className="cartao-bi-titulo">Desempenho por agente</h3>
            <table className="rank-tabela">
              <thead>
                <tr>
                  <th className="rank-pos">#</th>
                  <th>Agente</th>
                  <th className="rank-num">Solicitações</th>
                  <th className="rank-num">Vendas</th>
                  <th className="rank-num">Conversão</th>
                  <th className="rank-num">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {desempenho.map((d, i) => (
                  <tr key={d.id}>
                    <td className="rank-pos">{i + 1}</td>
                    <td><span className="rank-nome">{d.nome}</span></td>
                    <td className="rank-num">{fmtInt(d.solicitacoes)}</td>
                    <td className="rank-num">{fmtInt(d.vendas)}</td>
                    <td className="rank-num">
                      {d.solicitacoes > 0 ? fmtPct(d.vendas / d.solicitacoes) : '—'}
                    </td>
                    <td className="rank-num">{fmtReais(d.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="bi-grade">
          {sess.admin && (
            <div className="cartao-bi">
              <h3 className="cartao-bi-titulo">Agentes que mais solicitaram</h3>
              <TabelaRanking itens={rankings.agentes} rotuloN="Solicitações" />
            </div>
          )}
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
            <h3 className="cartao-bi-titulo">Cidades de origem</h3>
            <BarrasH itens={dist.cidades} cor="#0ba7da" />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Estilo de hospedagem preferido</h3>
            <BarrasH itens={dist.hospedagem} cor={AZUL} />
          </div>
          <div className="cartao-bi">
            <h3 className="cartao-bi-titulo">Interesse em hotéis nos complexos</h3>
            <Rosca fatias={dist.interesseComplexo} cores={CATEGORICA} />
          </div>
        </section>
      </main>
    </div>
  );
}
