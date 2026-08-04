import Link from 'next/link';
import type { SessaoPortal } from '@/lib/portal-auth';
import Notificacoes from './Notificacoes';

export default function PortalHeader({
  sess,
  ativo,
}: {
  sess: SessaoPortal;
  ativo?: 'sol' | 'leads' | 'dash' | 'link' | 'user';
}) {
  const cls = (a: string) => `portal-nav-link${ativo === a ? ' ativa' : ''}`;
  return (
    <header className="barra">
      <div className="barra-marca">
        <img className="barra-logo" src="/logo-cativa.png" alt="Cativa Orlando Expert" />
        <span className="marca-divisor" />
        <span className="marca-produto">Portal · {sess.agenciaNome}</span>
      </div>

      <nav className="portal-nav">
        <Link className={cls('sol')} href="/portal">Solicitações</Link>
        <Link className={cls('leads')} href="/portal/leads">Leads</Link>
        <Link className={cls('dash')} href="/portal/dashboard">Dashboard</Link>
        <Link className={cls('link')} href="/portal/meu-link">Meu Link</Link>
        {sess.admin && (
          <Link className={cls('user')} href="/portal/usuarios">Usuários</Link>
        )}
      </nav>

      <div className="portal-usuario">
        <Notificacoes />
        <Link href="/preferencias" className="portal-usuario-nome" title="Preferências">
          {sess.foto ? (
            <img className="usuario-foto" src={`/api/foto/${sess.foto}`} alt="" />
          ) : (
            <span className="usuario-foto usuario-foto-vazia" aria-hidden="true">
              {sess.nome.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
            </span>
          )}
          {sess.nome}
          {sess.admin && <span className="selo-admin">Admin</span>}
        </Link>
        <Link href="/api/portal/sair" className="sair" prefetch={false}>Sair</Link>
      </div>
    </header>
  );
}
