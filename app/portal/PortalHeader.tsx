import Link from 'next/link';
import type { SessaoPortal } from '@/lib/portal-auth';

export default function PortalHeader({
  sess,
  ativo,
}: {
  sess: SessaoPortal;
  ativo?: 'sol' | 'dash' | 'user';
}) {
  const cls = (a: string) => `portal-nav-link${ativo === a ? ' ativa' : ''}`;
  return (
    <header className="barra">
      <div className="barra-marca">
        <span className="marca-nome">Orlando Expert</span>
        <span className="marca-divisor" />
        <span className="marca-produto">Portal · {sess.agenciaNome}</span>
      </div>

      <nav className="portal-nav">
        <Link className={cls('sol')} href="/portal">Solicitações</Link>
        <Link className={cls('dash')} href="/portal/dashboard">Dashboard</Link>
        {sess.admin && (
          <Link className={cls('user')} href="/portal/usuarios">Usuários</Link>
        )}
      </nav>

      <div className="portal-usuario">
        <span className="portal-usuario-nome">
          {sess.nome}
          {sess.admin && <span className="selo-admin">Admin</span>}
        </span>
        <Link href="/api/portal/sair" className="sair" prefetch={false}>Sair</Link>
      </div>
    </header>
  );
}
