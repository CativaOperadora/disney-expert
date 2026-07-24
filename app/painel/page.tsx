import Link from 'next/link';
import { sql } from '@/lib/db';
import Quadro, { type Cartao } from './Quadro';

export const dynamic = 'force-dynamic';

export default async function Painel({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { ver } = await searchParams;
  const encerradas = ver === 'encerradas';
  const fechados = ['ganho', 'perdido', 'duplicada'];

  const cartoes = await sql<Cartao[]>`
    select
      s.id, s.protocolo, s.status, s.completude,
      s.cliente_nome, s.data_prevista_texto,
      s.total_pessoas, s.total_criancas,
      ag.nome as agencia_nome,
      ag.tier as agencia_tier,
      a.nome  as agente_nome,
      s.criado_em,
      coalesce(ult.em, s.criado_em) as parado_desde,
      exists (
        select 1 from envios_email e
        where e.solicitacao_id = s.id and e.status in ('bounce', 'falha')
      ) as email_falhou
    from solicitacoes s
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    left join lateral (
      select max(criado_em) as em
      from eventos
      where solicitacao_id = s.id and tipo = 'status_alterado'
    ) ult on true
    ${
      encerradas
        ? sql`where s.status = any(${fechados})`
        : sql`where s.status <> all(${fechados})`
    }
    order by coalesce(ult.em, s.criado_em) asc
    limit 400
  `;

  const [contagem] = await sql<{ abertas: number; encerradas: number }[]>`
    select
      count(*) filter (where status <> all(${fechados}))::int as abertas,
      count(*) filter (where status =  any(${fechados}))::int as encerradas
    from solicitacoes
  `;

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <span className="marca-nome">Cativa</span>
          <span className="marca-divisor" />
          <span className="marca-produto">Consultoria Disney</span>
        </div>

        <nav className="barra-abas">
          <Link href="/painel" className={`aba ${!encerradas ? 'ativa' : ''}`}>
            Quadro
            <span className="contador">{contagem.abertas}</span>
          </Link>
          <Link
            href="/painel?ver=encerradas"
            className={`aba ${encerradas ? 'ativa' : ''}`}
          >
            Encerradas
            <span className="contador">{contagem.encerradas}</span>
          </Link>
        </nav>

        <Link href="/api/sair" className="sair" prefetch={false}>
          Sair
        </Link>
      </header>

      <Quadro cartoes={cartoes} encerradas={encerradas} />
    </div>
  );
}
