import Link from 'next/link';
import { sql } from '@/lib/db';
import { juntarCard } from '@/lib/cards';
import Quadro, { type Cartao, type Coluna } from './Quadro';

export const dynamic = 'force-dynamic';

export default async function Painel() {
  // Quadro da CONSULTORIA: status e responsável saem do card deste lado.
  // O pipeline da agência é outro registro e não aparece aqui.
  const cartoes = await sql<Cartao[]>`
    select
      s.id, s.protocolo, c.status, s.completude, c.responsavel_id,
      s.data_prevista_texto, s.total_pessoas, s.total_criancas,
      s.criado_em, c.primeiro_atendimento_em,
      ag.nome      as agencia_nome,
      ag.tier      as agencia_tier,
      ag.sla_horas as sla_horas,
      a.nome       as agente_nome,
      exists (
        select 1 from envios_email e
        where e.solicitacao_id = s.id and e.status in ('bounce', 'falha')
      ) as email_falhou
    from solicitacoes s
    ${juntarCard('consultoria')}
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    where c.status <> 'duplicada'
    order by s.criado_em desc
    limit 600
  `;

  // Consultoras ativas: uma coluna de consultoria por especialista.
  const consultoras = await sql<{ id: string; nome: string }[]>`
    select id, nome from usuarios
    where papel = 'especialista' and ativo
    order by nome
  `;

  // As colunas do Kanban misturam status e carteira por consultora.
  const colunas: Coluna[] = [
    { chave: 'nova_solicitacao', titulo: 'Nova solicitação', status: 'nova_solicitacao', consultoraId: null, nota: 'Chegou, ninguém assumiu' },
    ...consultoras.map((c) => ({
      chave: `cons:${c.id}`,
      titulo: `Consultoria ${c.nome.split(' ')[0]}`,
      status: 'consultoria_realizada',
      consultoraId: c.id,
      nota: 'Carteira da consultora',
    })),
    { chave: 'venda_finalizada', titulo: 'Venda finalizada', status: 'venda_finalizada', consultoraId: null, nota: 'Reserva confirmada' },
    { chave: 'venda_perdida', titulo: 'Venda perdida', status: 'venda_perdida', consultoraId: null },
    { chave: 'concluida', titulo: 'Concluídas', status: 'concluida', consultoraId: null, nota: 'Encerrada e arquivada' },
  ];

  const abertas = cartoes.filter(
    (c) => !['venda_finalizada', 'venda_perdida', 'concluida'].includes(c.status),
  ).length;

  return (
    <div className="tela">
      <header className="barra">
        <div className="barra-marca">
          <img className="barra-logo" src="/logo-cativa.png" alt="Cativa Orlando Expert" />
          <span className="marca-divisor" />
          <span className="marca-produto">Consultoria</span>
        </div>

        <div className="barra-info">
          {abertas} {abertas === 1 ? 'solicitação aberta' : 'solicitações abertas'}
        </div>

        <Link href="/painel/dashboards" className="barra-link" prefetch={false}>
          Dashboards
        </Link>

        <Link href="/painel/agencias" className="barra-link" prefetch={false}>
          Agências
        </Link>

        <Link href="/api/sair" className="sair" prefetch={false}>
          Sair
        </Link>
      </header>

      <Quadro cartoes={cartoes} colunas={colunas} agora={Date.now()} />
    </div>
  );
}
