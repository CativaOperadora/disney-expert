import Link from 'next/link';
import type { SessaoPortal } from '@/lib/portal-auth';
import Notificacoes from './Notificacoes';
import MenuUsuario, {
  ICONE_PERFIL, ICONE_DASHBOARD, ICONE_LINK,
} from '../MenuUsuario';

/**
 * A navegação principal fica só com o trabalho COMPARTILHADO da agência.
 * Tudo que é "meu" — perfil, meu dashboard, meu link — vai para o menu
 * do próprio usuário, aberto pelo nome no canto direito.
 */
export default function PortalHeader({
  sess,
  ativo,
}: {
  sess: SessaoPortal;
  ativo?: 'sol' | 'leads' | 'user';
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
        {sess.admin && (
          <Link className={cls('user')} href="/portal/usuarios">Usuários</Link>
        )}
      </nav>

      <div className="portal-usuario">
        <Notificacoes />
        <MenuUsuario
          nome={sess.nome}
          foto={sess.foto}
          selo={sess.admin ? 'Admin' : null}
          sairHref="/api/portal/sair"
          itens={[
            {
              href: '/perfil',
              rotulo: 'Editar meu perfil',
              descricao: 'Nome, foto, tema e senha',
              icone: ICONE_PERFIL,
            },
            {
              href: '/portal/dashboard',
              rotulo: sess.admin ? 'Dashboard da agência' : 'Meu dashboard',
              descricao: 'Vendas, conversão e faturamento',
              icone: ICONE_DASHBOARD,
            },
            {
              href: '/portal/meu-link',
              rotulo: 'Meu link',
              descricao: 'Link e QR de captação',
              icone: ICONE_LINK,
            },
          ]}
        />
      </div>
    </header>
  );
}
