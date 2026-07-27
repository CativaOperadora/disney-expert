import Link from 'next/link';
import { sql } from '@/lib/db';
import Quadro, { type Cartao } from './Quadro';

export const dynamic = 'force-dynamic';

export default async function Painel() {
  const cartoes = await sql<Cartao[]>`
    select
      s.id, s.protocolo, s.status, s.completude,
      s.data_prevista_texto, s.total_pessoas, s.total_criancas,
      s.criado_em, s.primeiro_atendimento_em,
      ag.nome      as agencia_nome,
      ag.tier      as agencia_tier,
      ag.sla_horas as sla_horas,
      a.nome       as agente_nome,
      exists (
        select 1 from envios_email e
        where e.solicitacao_id = s.id and e.status in ('bounce', 'falha')
      ) as email_falhou
    from solicitacoes s
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    where s.status <> 'duplicada'
    order by s.criado_em desc
    limit 400
  `;

  const abertas = cartoes.filter(
    (c) => !['venda_finalizada', 'venda_perdida'].includes(c.status),
  ).length;

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <img className="barra-logo" src="/logo-topo.png" alt="Orlando Expert" />
          <span className="marca-divisor" />
          <span className="marca-produto">Consultoria</span>
        </div>

        <div className="barra-info">
          {abertas} {abertas === 1 ? 'solicitação aberta' : 'solicitações abertas'}
        </div>

        <Link href="/painel/dashboards" className="barra-link" prefetch={false}>
          Dashboards
        </Link>

        <Link href="/api/sair" className="sair" prefetch={false}>
          Sair
        </Link>
      </header>

      <Quadro cartoes={cartoes} agora={Date.now()} />
    </div>
  );
}
