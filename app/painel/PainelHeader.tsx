import Link from 'next/link';
import { sessaoPainel } from '@/lib/auth';
import MenuUsuario, { ICONE_PERFIL } from '../MenuUsuario';

/**
 * Cabeçalho do CRM interno.
 *
 * Estava copiado em três páginas, o que fez o link de Preferências nascer
 * só numa delas. Agora é um componente só.
 *
 * A navegação guarda o trabalho compartilhado (dashboards, agências); o
 * que é da pessoa vai para o menu do próprio nome, igual ao Portal.
 *
 * Quem entrou pela senha compartilhada não tem usuário associado: o menu
 * então não oferece "Editar meu perfil", porque não há perfil a editar.
 */
export default async function PainelHeader({
  info,
  titulo = 'Consultoria',
}: {
  /** Texto livre à direita da marca. Ex.: "3 solicitações abertas". */
  info?: string;
  /** Rótulo da seção, ao lado da marca. */
  titulo?: string;
}) {
  const sess = await sessaoPainel();

  return (
    <header className="barra">
      <div className="barra-marca">
        <img className="barra-logo" src="/logo-cativa.png" alt="Cativa Orlando Expert" />
        <span className="marca-divisor" />
        <span className="marca-produto">{titulo}</span>
      </div>

      {info && <div className="barra-info">{info}</div>}

      <nav className="portal-nav">
        <Link className="portal-nav-link" href="/painel" prefetch={false}>Fila</Link>
        <Link className="portal-nav-link" href="/painel/dashboards" prefetch={false}>Dashboards</Link>
        <Link className="portal-nav-link" href="/painel/agencias" prefetch={false}>Agências</Link>
      </nav>

      <div className="portal-usuario">
        <MenuUsuario
          nome={sess?.nome ?? 'Equipe Cativa'}
          foto={sess?.foto ?? null}
          sairHref="/api/sair"
          itens={
            sess?.usuarioId
              ? [
                  {
                    href: '/perfil',
                    rotulo: 'Editar meu perfil',
                    descricao: 'Nome, foto, tema e senha',
                    icone: ICONE_PERFIL,
                  },
                ]
              : []
          }
        />
      </div>
    </header>
  );
}
