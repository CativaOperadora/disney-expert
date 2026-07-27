import Link from 'next/link';
import { listarAgencias } from '@/lib/superadmin';
import Agencias from './Agencias';

export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default async function PaginaAgencias() {
  const lista = await listarAgencias();
  const agencias = lista.map((a) => ({
    id: a.id,
    nome: a.nome,
    tier: a.tier,
    ativa: a.ativa,
    total_agentes: a.total_agentes,
    solicitacoes: a.solicitacoes,
    admin_nome: a.admin_nome,
    admin_email: a.admin_email,
    criadoFmt: DATA.format(new Date(a.criado_em)),
  }));

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <img className="barra-logo" src="/logo-cativa.png" alt="Cativa Orlando Expert" />
          <span className="marca-divisor" />
          <span className="marca-produto">Administração da plataforma</span>
        </div>
        <nav className="portal-nav">
          <Link className="portal-nav-link" href="/painel">← CRM</Link>
        </nav>
        <Link href="/api/sair" className="sair" prefetch={false}>Sair</Link>
      </header>

      <main className="portal">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">Agências</h1>
            <p className="portal-sub">
              Cadastre novas organizações e seus administradores. Cada agência é
              isolada — o administrador criado gerencia apenas os próprios agentes.
            </p>
          </div>
        </div>
        <Agencias agencias={agencias} />
      </main>
    </div>
  );
}
