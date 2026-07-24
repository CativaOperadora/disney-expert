import Link from 'next/link';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ROTULO_STATUS: Record<string, string> = {
  novo: 'Novo',
  triagem: 'Triagem',
  em_analise: 'Em análise',
  consultoria_entregue: 'Consultoria entregue',
  com_agencia: 'Com a agência',
  follow_up: 'Follow-up',
  ganho: 'Reserva confirmada',
  perdido: 'Perdido',
  duplicada: 'Duplicada',
};

interface Linha {
  id: string;
  protocolo: string;
  status: string;
  prioridade: number;
  completude: number;
  cliente_nome: string;
  data_prevista_texto: string | null;
  total_pessoas: number | null;
  total_criancas: number | null;
  agencia_nome: string | null;
  agente_nome: string | null;
  criado_em: string;
}

function desde(iso: string) {
  const horas = (Date.now() - new Date(iso).getTime()) / 3600_000;
  if (horas < 1) return 'agora há pouco';
  if (horas < 24) return `há ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

export default async function Fila({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const fechados = ['ganho', 'perdido', 'duplicada'];

  const linhas = await sql<Linha[]>`
    select
      s.id, s.protocolo, s.status, s.prioridade, s.completude,
      s.cliente_nome, s.data_prevista_texto,
      s.total_pessoas, s.total_criancas,
      ag.nome as agencia_nome,
      a.nome  as agente_nome,
      s.criado_em
    from solicitacoes s
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    ${
      status === 'fechados'
        ? sql`where s.status = any(${fechados})`
        : sql`where s.status <> all(${fechados})`
    }
    order by s.prioridade desc, s.criado_em asc
    limit 200
  `;

  const [{ abertas, fechadas }] = await sql<
    { abertas: number; fechadas: number }[]
  >`
    select
      count(*) filter (where status <> all(${fechados}))::int as abertas,
      count(*) filter (where status =  any(${fechados}))::int as fechadas
    from solicitacoes
  `;

  return (
    <main className="painel">
      <header className="painel-topo">
        <div>
          <h1 className="display painel-titulo">Consultoria Disney</h1>
          <p className="painel-sub">
            {abertas} {abertas === 1 ? 'solicitação aberta' : 'solicitações abertas'}
          </p>
        </div>
        <Link href="/api/sair" className="botao botao-voltar" prefetch={false}>
          Sair
        </Link>
      </header>

      <nav className="abas">
        <Link
          href="/painel"
          className={`aba ${status !== 'fechados' ? 'ativa' : ''}`}
        >
          Em atendimento ({abertas})
        </Link>
        <Link
          href="/painel?status=fechados"
          className={`aba ${status === 'fechados' ? 'ativa' : ''}`}
        >
          Encerradas ({fechadas})
        </Link>
      </nav>

      {linhas.length === 0 ? (
        <div className="vazio">
          <p>Nenhuma solicitação por aqui ainda.</p>
        </div>
      ) : (
        <ul className="cartoes">
          {linhas.map((s) => (
            <li key={s.id}>
              <Link href={`/painel/${s.id}`} className="cartao">
                <div className="cartao-topo">
                  <span className="cartao-protocolo">{s.protocolo}</span>
                  <span className={`etiqueta e-${s.status}`}>
                    {ROTULO_STATUS[s.status] ?? s.status}
                  </span>
                </div>

                <div className="cartao-nome">{s.cliente_nome}</div>

                <div className="cartao-linha">
                  {s.total_pessoas ?? '?'} pessoas
                  {s.total_criancas ? `, ${s.total_criancas} criança${s.total_criancas > 1 ? 's' : ''}` : ''}
                  {s.data_prevista_texto ? ` · ${s.data_prevista_texto}` : ''}
                </div>

                <div className="cartao-rodape">
                  <span>{s.agencia_nome ?? 'Agência não identificada'}</span>
                  <span>{desde(s.criado_em)}</span>
                </div>

                {s.completude < 100 && (
                  <div className="cartao-alerta">
                    Briefing {s.completude}% preenchido
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
