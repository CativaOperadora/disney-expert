import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import { detalheSolicitacao, timelineSolicitacao } from '@/lib/portal';
import { PERGUNTAS, PASSOS } from '@/lib/perguntas';
import { MOTIVOS_PERDA } from '@/lib/sla';
import PortalHeader from '../PortalHeader';
import CamposVenda from './CamposVenda';

export const dynamic = 'force-dynamic';

const DATAHORA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const reais = (v: string | null) =>
  v == null ? '—' : `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

const MOTIVO: Record<string, string> = Object.fromEntries(MOTIVOS_PERDA.map(([v, r]) => [v, r]));

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

export default async function PortalDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');

  const { id } = await params;
  const s = await detalheSolicitacao(sess, id);
  if (!s) notFound(); // fora do escopo = inexistente, do ponto de vista do portal

  const timeline = await timelineSolicitacao(s.id);

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

  const ganha = s.status === 'venda_finalizada';
  const perdida = s.status === 'venda_perdida';

  return (
    <div className="tela">
      <PortalHeader sess={sess} ativo="sol" />

      <main className="portal portal-detalhe">
        <Link href="/portal" className="voltar-link">← Voltar para as solicitações</Link>

        <header className="portal-det-topo">
          <div>
            <span className="portal-protocolo grande">{s.protocolo}</span>
            <h1 className="portal-titulo">{s.cliente_nome}</h1>
            <p className="portal-sub">
              Recebido em {DATAHORA.format(new Date(s.criado_em))}
              {sess.admin && s.agente_nome ? ` · Agente: ${s.agente_nome}` : ''}
            </p>
          </div>
          <span className={`status-tag grande status-${s.status}`}>{s.status_rotulo}</span>
        </header>

        <div className="portal-det-grade">
          <div className="portal-det-principal">
            {/* Dados do cliente */}
            <section className="cartao-bi">
              <h3 className="cartao-bi-titulo">Cliente</h3>
              <dl className="portal-dl">
                <div><dt>Nome</dt><dd>{s.cliente_nome}</dd></div>
                <div><dt>E-mail</dt><dd>{s.cliente_email}</dd></div>
                <div><dt>WhatsApp</dt><dd>{s.cliente_whatsapp}</dd></div>
                <div><dt>Cidade de origem</dt><dd>{s.origem_embarque ?? '—'}</dd></div>
                <div><dt>Viajantes</dt><dd>{s.total_pessoas ?? '—'}{s.total_criancas ? ` (${s.total_criancas} criança${s.total_criancas > 1 ? 's' : ''})` : ''}</dd></div>
                <div><dt>Período</dt><dd>{s.data_prevista_texto ?? '—'}</dd></div>
              </dl>
            </section>

            {/* Briefing completo */}
            {blocos.map((b) => (
              <section className="cartao-bi" key={b.titulo}>
                <h3 className="cartao-bi-titulo">{b.titulo}</h3>
                <dl className="portal-dl">
                  {b.itens.map((i) => (
                    <div key={i.rotulo}><dt>{i.rotulo}</dt><dd>{i.valor}</dd></div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <aside className="portal-det-lado">
            {/* Venda — leitura em vendas perdidas; editável nas demais.
                O acesso já é garantido por detalheSolicitacao(sess, id):
                agente só alcança o que originou, admin toda a agência. */}
            <section className="cartao-bi">
              <h3 className="cartao-bi-titulo">Venda</h3>
              {perdida ? (
                <p className="portal-nota">
                  Venda não concretizada
                  {s.motivo_perda ? ` · ${MOTIVO[s.motivo_perda] ?? s.motivo_perda}` : ''}.
                </p>
              ) : (
                <>
                  {ganha && (
                    <dl className="portal-dl" style={{ marginBottom: 20 }}>
                      <div>
                        <dt>Valor registrado</dt>
                        <dd className="valor-forte">{reais(s.valor_total_venda)}</dd>
                      </div>
                      <div>
                        <dt>Fechada em</dt>
                        <dd>{s.venda_em ? DATAHORA.format(new Date(s.venda_em)) : '—'}</dd>
                      </div>
                    </dl>
                  )}
                  <CamposVenda
                    id={s.id}
                    valorVenda={s.valor_total_venda}
                    idReserva={s.id_reserva}
                    ganha={ganha}
                  />
                </>
              )}
            </section>

            {/* Timeline */}
            <section className="cartao-bi">
              <h3 className="cartao-bi-titulo">Linha do tempo</h3>
              <ol className="portal-timeline">
                {timeline.map((e, i) => (
                  <li key={i}>
                    <span className="tl-ponto" />
                    <div>
                      <span className="tl-quando">{DATAHORA.format(new Date(e.criado_em))}</span>
                      <span className="tl-rotulo">{e.rotulo}</span>
                      {e.descricao && e.tipo === 'comentario' && <p className="tl-desc">{e.descricao}</p>}
                    </div>
                  </li>
                ))}
                {timeline.length === 0 && <li className="portal-nota">Sem movimentações registradas ainda.</li>}
              </ol>
            </section>

            {/* Documentos */}
            <section className="cartao-bi">
              <h3 className="cartao-bi-titulo">Documentos</h3>
              <p className="portal-nota">
                Nenhum documento anexado. Propostas e vouchers enviados pela
                consultoria aparecerão aqui.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
