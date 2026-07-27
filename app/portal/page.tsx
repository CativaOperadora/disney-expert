import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarSolicitacoes } from '@/lib/portal';
import { STATUS } from '@/lib/sla';
import PortalHeader from './PortalHeader';
import SeletorVista from './SeletorVista';
import PortalKanban from './PortalKanban';

export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
const reais = (v: string | null) =>
  v == null ? '—' : `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

function texto(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : null;
}

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');

  const sp = await searchParams;
  const filtros = {
    busca: texto(sp.busca),
    status: texto(sp.status),
    de: texto(sp.de),
    ate: texto(sp.ate),
  };
  const linhas = await listarSolicitacoes(sess, filtros);
  const vista = texto(sp.vista) === 'kanban' ? 'kanban' : 'lista';

  const vendas = linhas.filter((l) => l.status === 'venda_finalizada');
  const faturamento = vendas.reduce((s, l) => s + Number(l.valor_total_venda ?? 0), 0);

  return (
    <div className="tela">
      <PortalHeader sess={sess} ativo="sol" />

      <main className="portal">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">
              {sess.admin ? 'Solicitações da agência' : 'Minhas solicitações'}
            </h1>
            <p className="portal-sub">
              {sess.admin
                ? `Todas as tratativas de ${sess.agenciaNome}.`
                : 'O histórico completo das suas tratativas com a consultoria Orlando Expert.'}
            </p>
          </div>
          <div className="portal-topo-acoes">
            <SeletorVista vista={vista} />
            <Link href="/portal/dashboard" className="botao botao-principal portal-cta">
              Ver dashboard
            </Link>
          </div>
        </div>

        {vista !== 'kanban' && (
          <div className="portal-tiles">
            <div className="portal-tile">
              <span className="portal-tile-num">{linhas.length}</span>
              <span className="portal-tile-rot">solicitações</span>
            </div>
            <div className="portal-tile">
              <span className="portal-tile-num">
                {linhas.filter((l) => l.status === 'consultoria_realizada').length}
              </span>
              <span className="portal-tile-rot">em consultoria</span>
            </div>
            <div className="portal-tile">
              <span className="portal-tile-num">{vendas.length}</span>
              <span className="portal-tile-rot">vendas</span>
            </div>
            <div className="portal-tile">
              <span className="portal-tile-num">{reais(String(faturamento))}</span>
              <span className="portal-tile-rot">faturamento</span>
            </div>
          </div>
        )}

        <form className="portal-filtros" method="get">
          <input
            className="entrada"
            type="search"
            name="busca"
            placeholder="Buscar por cliente ou protocolo"
            defaultValue={filtros.busca ?? ''}
          />
          <select className="entrada" name="status" defaultValue={filtros.status ?? ''}>
            <option value="">Todas as situações</option>
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>{s.titulo}</option>
            ))}
          </select>
          <input className="entrada" type="date" name="de" defaultValue={filtros.de ?? ''} aria-label="De" />
          <input className="entrada" type="date" name="ate" defaultValue={filtros.ate ?? ''} aria-label="Até" />
          <button className="botao botao-voltar" type="submit">Filtrar</button>
          <Link href="/portal" className="portal-limpar">Limpar</Link>
        </form>

        {vista === 'kanban' ? (
          <PortalKanban linhas={linhas} admin={sess.admin} />
        ) : (
        <div className="portal-tabela-wrap">
          <table className="portal-tabela">
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Cliente</th>
                {sess.admin && <th>Agente</th>}
                <th>Situação</th>
                <th>Viagem</th>
                <th className="col-num">Pessoas</th>
                <th className="col-num">Valor</th>
                <th className="col-num">Recebido</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="portal-linha">
                  <td>
                    <Link href={`/portal/${l.id}`} className="portal-protocolo">{l.protocolo}</Link>
                  </td>
                  <td>{l.cliente_nome}</td>
                  {sess.admin && <td className="portal-agente">{l.agente_nome ?? '—'}</td>}
                  <td>
                    <span className={`status-tag status-${l.status}`}>{l.status_rotulo}</span>
                  </td>
                  <td>{l.data_prevista_texto ?? '—'}</td>
                  <td className="col-num">{l.total_pessoas ?? '—'}</td>
                  <td className="col-num">{l.status === 'venda_finalizada' ? reais(l.valor_total_venda) : '—'}</td>
                  <td className="col-num">{DATA.format(new Date(l.criado_em))}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={sess.admin ? 8 : 7} className="portal-vazio">
                    Nenhuma solicitação encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </main>
    </div>
  );
}
