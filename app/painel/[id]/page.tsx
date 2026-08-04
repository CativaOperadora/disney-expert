import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import { PERGUNTAS, PASSOS } from '@/lib/perguntas';
import { ROTULO_STATUS, ROTULO_MOTIVO, calcularSla } from '@/lib/sla';
import { listarAnexos } from '@/lib/anexos';
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
  id_reserva: string | null;
  valor_total_venda: string | null;
  motivo_perda: string | null;
  descricao_perda: string | null;
  responsavel_id: string | null;
  respostas: Record<string, any>;
  criado_em: string;
  primeiro_atendimento_em: string | null;
  sla_horas: number | null;
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
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}$/.test(valor)) {
    const [a, m] = valor.split('-');
    return `${m}/${a}`;
  }
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
      s.id_reserva, s.valor_total_venda, s.responsavel_id,
      s.motivo_perda, s.descricao_perda,
      s.respostas, s.criado_em, s.primeiro_atendimento_em,
      ag.sla_horas,
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

  // Imagens do registro da perda. Só busca quando faz sentido.
  const anexosPerda =
    s.status === 'venda_perdida' ? await listarAnexos(s.id) : [];

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

  // Consultoras do time interno, para atribuir o responsável (alimenta o BI).
  const consultoras = await sql<{ id: string; nome: string }[]>`
    select id, nome from usuarios where ativo order by nome
  `;

  // O briefing segue a ordem do formulário, não a ordem do JSON.
  const blocos = PASSOS.map((passo) => ({
    titulo: passo.titulo,
    itens: PERGUNTAS.filter(
      (p) =>
        p.passo === passo.numero &&
        p.tipo !== 'aceite' &&
        s.respostas[p.id] !== undefined &&
        s.respostas[p.id] !== '',
    ).map((p) => ({ rotulo: p.rotulo, valor: formatar(s.respostas[p.id]) })),
  })).filter((b) => b.itens.length > 0);

  const sla = calcularSla(
    s.criado_em,
    s.sla_horas ?? 48,
    s.primeiro_atendimento_em,
  );

  return (
    <main className="painel">
      <Link href="/painel" className="voltar-link">
        ← Voltar para a fila
      </Link>

      <header className="detalhe-topo">
        <span className="cartao-protocolo">{s.protocolo}</span>
        <h1 className="display painel-titulo">
          {s.agente_nome ?? 'Agente não identificado'}
        </h1>
        <p className="painel-sub">
          {s.agencia_nome ?? 'Agência não identificada'} ·{' '}
          {ROTULO_STATUS[s.status] ?? s.status}
        </p>
        {s.status === 'venda_perdida' && (
          <span className="tag-perdida grande">Venda Perdida</span>
        )}
        <div className={`sla-detalhe sla-${sla.faixa}`}>
          <span className="sla-texto">{sla.rotulo}</span>
          <span className="sla-prazo">
            prazo de {s.sla_horas ?? 48}h · recebido em{' '}
            {QUANDO.format(new Date(s.criado_em))}
          </span>
        </div>
      </header>

      {s.status === 'venda_perdida' && (
        <section className="caixa caixa-perda">
          <h2 className="caixa-titulo">Registro da perda</h2>
          <dl className="portal-dl">
            <div>
              <dt>Motivo</dt>
              <dd>
                {s.motivo_perda
                  ? (ROTULO_MOTIVO[s.motivo_perda] ?? s.motivo_perda)
                  : '—'}
              </dd>
            </div>
          </dl>

          {s.descricao_perda && (
            <p className="perda-descricao">{s.descricao_perda}</p>
          )}

          {anexosPerda.length > 0 && (
            <>
              <h3 className="perda-subtitulo">
                {anexosPerda.length}{' '}
                {anexosPerda.length === 1 ? 'imagem anexada' : 'imagens anexadas'}
              </h3>
              <ul className="perda-galeria">
                {anexosPerda.map((a) => (
                  <li key={a.id}>
                    {/* Servido por /api/anexos/[id], que confere a sessão.
                        Os binários ficam fora de public/ de propósito. */}
                    <a href={`/api/anexos/${a.id}`} target="_blank" rel="noreferrer">
                      <img src={`/api/anexos/${a.id}`} alt={a.nome_original} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

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
                <span className="selo-select">Agência Select</span>
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
            <span className="dado-rotulo">Nome</span>
            <span className="dado-valor">{s.cliente_nome}</span>
          </div>
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
        <section className="caixa" key={b.titulo}>
          <h2 className="caixa-titulo">{b.titulo}</h2>
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

      <Acoes
        id={s.id}
        statusAtual={s.status}
        idReserva={s.id_reserva}
        valorVenda={s.valor_total_venda}
        responsavelId={s.responsavel_id}
        consultoras={consultoras}
      />

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
