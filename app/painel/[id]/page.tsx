import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { PERGUNTAS } from '@/lib/perguntas';
import Acoes from './Acoes';

export const dynamic = 'force-dynamic';

interface Detalhe {
  id: string;
  protocolo: string;
  status: string;
  completude: number;
  cliente_nome: string;
  cliente_email: string;
  cliente_whatsapp: string;
  respostas: Record<string, any>;
  criado_em: string;
  agente_nome: string | null;
  agente_email: string | null;
  agencia_nome: string | null;
  agencia_tier: string | null;
}

interface Evento {
  id: string;
  tipo: string;
  descricao: string | null;
  criado_em: string;
}

interface Envio {
  tipo: string;
  destinatario: string;
  status: string;
}

const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

const ROTULO_EVENTO: Record<string, string> = {
  criada: 'Formulário recebido',
  status_alterado: 'Status alterado',
  comentario: 'Anotação',
  email_disparado: 'E-mail enviado',
  email_entregue: 'E-mail entregue',
  email_bounce: 'E-mail voltou',
};

function formatar(valor: any): string {
  if (Array.isArray(valor)) return valor.join(', ');
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return String(valor);
}

export default async function PaginaDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [s] = await sql<Detalhe[]>`
    select
      s.id, s.protocolo, s.status, s.completude,
      s.cliente_nome, s.cliente_email, s.cliente_whatsapp,
      s.respostas, s.criado_em,
      a.nome  as agente_nome,
      a.email as agente_email,
      ag.nome as agencia_nome,
      ag.tier as agencia_tier
    from solicitacoes s
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    where s.id = ${id}
  `;
  if (!s) notFound();

  const eventos = await sql<Evento[]>`
    select id, tipo, descricao, criado_em
    from eventos where solicitacao_id = ${id}
    order by criado_em desc
  `;

  const envios = await sql<Envio[]>`
    select tipo, destinatario, status
    from envios_email where solicitacao_id = ${id}
    order by criado_em
  `;

  // O briefing segue a ordem do formulário, não a ordem do JSON.
  const blocos = [1, 2, 3, 4, 5].map((passo) => ({
    passo,
    itens: PERGUNTAS.filter(
      (p) =>
        p.passo === passo &&
        p.tipo !== 'aceite' &&
        s.respostas[p.id] !== undefined &&
        s.respostas[p.id] !== '',
    ).map((p) => ({ rotulo: p.rotulo, valor: formatar(s.respostas[p.id]) })),
  })).filter((b) => b.itens.length > 0);

  return (
    <main className="painel">
      <Link href="/painel" className="voltar-link">
        ← Voltar para a fila
      </Link>

      <header className="detalhe-topo">
        <span className="cartao-protocolo">{s.protocolo}</span>
        <h1 className="display painel-titulo">{s.cliente_nome}</h1>
        <p className="painel-sub">
          Recebido em {QUANDO.format(new Date(s.criado_em))} · briefing{' '}
          {s.completude}% preenchido
        </p>
      </header>

      <section className="caixa">
        <h2 className="caixa-titulo">Quem atende</h2>
        <div className="dupla">
          <div>
            <span className="dado-rotulo">Agente</span>
            <span className="dado-valor">
              {s.agente_nome ?? 'Não identificado'}
            </span>
            {s.agente_email && (
              <a className="dado-link" href={`mailto:${s.agente_email}`}>
                {s.agente_email}
              </a>
            )}
          </div>
          <div>
            <span className="dado-rotulo">Agência</span>
            <span className="dado-valor">
              {s.agencia_nome ?? 'Não identificada'}
              {s.agencia_tier === 'select' && (
                <span className="selo-select">Select</span>
              )}
            </span>
          </div>
        </div>
        <p className="nota">
          A consultoria é entregue à agência. O contato com o cliente final é
          feito pelo agente.
        </p>
      </section>

      <section className="caixa">
        <h2 className="caixa-titulo">Cliente final</h2>
        <div className="dupla">
          <div>
            <span className="dado-rotulo">E-mail</span>
            <span className="dado-valor">{s.cliente_email}</span>
          </div>
          <div>
            <span className="dado-rotulo">WhatsApp</span>
            <span className="dado-valor">{s.cliente_whatsapp}</span>
          </div>
        </div>
      </section>

      {blocos.map((b) => (
        <section className="caixa" key={b.passo}>
          <h2 className="caixa-titulo">Briefing · passo {b.passo}</h2>
          <dl className="briefing">
            {b.itens.map((i) => (
              <div className="briefing-item" key={i.rotulo}>
                <dt>{i.rotulo}</dt>
                <dd>{i.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <Acoes id={s.id} statusAtual={s.status} />

      <section className="caixa">
        <h2 className="caixa-titulo">E-mails</h2>
        <ul className="lista-simples">
          {envios.map((e) => (
            <li key={e.tipo}>
              <span>{e.tipo.replace(/_/g, ' ')}</span>
              <span className="dado-rotulo">{e.destinatario}</span>
              <span className={`etiqueta e-${e.status}`}>{e.status}</span>
            </li>
          ))}
          {envios.length === 0 && <li>Nenhum envio registrado.</li>}
        </ul>
      </section>

      <section className="caixa">
        <h2 className="caixa-titulo">Linha do tempo</h2>
        <ol className="tempo">
          {eventos.map((e) => (
            <li key={e.id}>
              <span className="tempo-quando">
                {QUANDO.format(new Date(e.criado_em))}
              </span>
              <span className="tempo-tipo">
                {ROTULO_EVENTO[e.tipo] ?? e.tipo}
              </span>
              {e.descricao && <p className="tempo-texto">{e.descricao}</p>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
