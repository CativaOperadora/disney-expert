import { redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarLeads, resumirLeads, type FiltroLeads } from '@/lib/leads';
import { STATUS } from '@/lib/sla';
import PortalHeader from '../PortalHeader';
import TabelaLeads from './TabelaLeads';

export const dynamic = 'force-dynamic';

function texto(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : null;
}
function data(v: string | string[] | undefined): string | null {
  const s = texto(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export default async function PortalLeads({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');

  const sp = await searchParams;
  const filtros: FiltroLeads = {
    busca: texto(sp.busca),
    status: texto(sp.status),
    de: data(sp.de),
    ate: data(sp.ate),
    somenteMarketing: texto(sp.campanha) === '1',
  };

  const leads = await listarLeads(sess, filtros);
  const resumo = resumirLeads(leads);

  return (
    <div className="tela">
      <PortalHeader sess={sess} ativo="leads" />

      <main className="portal">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">Leads</h1>
            <p className="portal-sub">
              {sess.admin
                ? `Todos os contatos captados por ${sess.agenciaNome}.`
                : 'Os contatos captados pelo seu link.'}{' '}
              Uma linha por pessoa — quem pediu orçamento mais de uma vez
              aparece uma vez só.
            </p>
          </div>
        </div>

        <div className="portal-tiles">
          <div className="portal-tile">
            <span className="portal-tile-num">{resumo.total}</span>
            <span className="portal-tile-rot">contatos</span>
          </div>
          <div className="portal-tile">
            <span className="portal-tile-num">{resumo.aptosCampanha}</span>
            <span className="portal-tile-rot">aceitam campanha</span>
          </div>
          <div className="portal-tile">
            <span className="portal-tile-num">{resumo.comVenda}</span>
            <span className="portal-tile-rot">já compraram</span>
          </div>
          <div className="portal-tile">
            <span className="portal-tile-num">{resumo.recorrentes}</span>
            <span className="portal-tile-rot">pediram mais de uma vez</span>
          </div>
        </div>

        <form className="portal-filtros" method="get">
          <input
            className="entrada"
            type="search"
            name="busca"
            placeholder="Buscar por nome, e-mail ou WhatsApp"
            defaultValue={filtros.busca ?? ''}
          />
          <select className="entrada" name="status" defaultValue={filtros.status ?? ''}>
            <option value="">Qualquer situação</option>
            {STATUS.map((s) => (
              <option key={s.id} value={s.id}>{s.titulo}</option>
            ))}
          </select>
          <input className="entrada" type="date" name="de" defaultValue={filtros.de ?? ''} aria-label="De" />
          <input className="entrada" type="date" name="ate" defaultValue={filtros.ate ?? ''} aria-label="Até" />
          <label className="leads-check-filtro">
            <input
              type="checkbox"
              name="campanha"
              value="1"
              defaultChecked={filtros.somenteMarketing}
            />
            Só quem aceita campanha
          </label>
          <button className="botao botao-voltar" type="submit">Filtrar</button>
        </form>

        <TabelaLeads leads={leads} filtros={filtros} admin={sess.admin} />
      </main>
    </div>
  );
}
