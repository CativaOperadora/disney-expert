import Link from 'next/link';
import { listarAgencias } from '@/lib/superadmin';
import Agencias from './Agencias';
import PainelHeader from '../PainelHeader';

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
      <PainelHeader titulo="Administração da plataforma" />

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
