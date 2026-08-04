import { redirect } from 'next/navigation';
import { identidadeAtual } from '@/lib/sessao-atual';
import { sessaoPortal } from '@/lib/portal-auth';
import PortalHeader from '../portal/PortalHeader';
import Preferencias from './Preferencias';

export const dynamic = 'force-dynamic';

/**
 * Tela única de preferências, para as duas áreas.
 *
 * Quem entrou pela senha compartilhada do CRM não tem usuário associado,
 * então não há preferência a editar: é mandado para o painel. Isso deixa
 * de acontecer assim que a pessoa passar a usar login individual.
 */
export default async function PaginaPreferencias() {
  const eu = await identidadeAtual();
  if (!eu) redirect('/entrar');

  if (eu.area === 'portal') {
    const sess = await sessaoPortal();
    return (
      <div className="tela">
        {sess && <PortalHeader sess={sess} />}
        <Preferencias voltarPara="/portal" />
      </div>
    );
  }

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <img className="barra-logo" src="/logo-cativa.png" alt="Cativa Orlando Expert" />
          <span className="marca-divisor" />
          <span className="marca-produto">Consultoria</span>
        </div>
        <a href="/painel" className="barra-link">← Voltar ao painel</a>
      </header>
      <Preferencias voltarPara="/painel" />
    </div>
  );
}
