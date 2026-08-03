import Link from 'next/link';
import { STATUS } from '@/lib/sla';
import type { LinhaSolicitacao } from '@/lib/portal';

/**
 * Kanban do Portal — somente leitura.
 *
 * As colunas seguem os mesmos status do CRM interno (fonte única em
 * lib/sla.ts), garantindo consistência total com o que a consultoria
 * registra. Aqui não há arraste nem mudança de etapa: o card só abre o
 * detalhe. Toda movimentação continua no CRM interno.
 *
 * O recorte por perfil já vem pronto: `linhas` é o resultado de
 * listarSolicitacoes(sess), que isola por agente (agente vê o próprio)
 * ou por agência (admin vê a organização).
 */

const DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
});
const reais = (v: string | null) =>
  v == null
    ? '—'
    : `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

export default function PortalKanban({
  linhas,
  admin,
}: {
  linhas: LinhaSolicitacao[];
  admin: boolean;
}) {
  return (
    <div className="portal-kanban">
      <div className="pk-quadro">
        {STATUS.map((col) => {
          const cards = linhas
            .filter((l) => l.status === col.id)
            .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em));
          return (
            <section className="pk-coluna" key={col.id}>
              <header className="pk-coluna-topo">
                <span className={`pk-ponto status-ponto-${col.id}`} />
                <h2 className="pk-coluna-titulo">{col.titulo}</h2>
                <span className="pk-coluna-conta">{cards.length}</span>
              </header>

              <div className="pk-coluna-corpo">
                {cards.map((c) => (
                  <Link
                    href={`/portal/${c.id}`}
                    key={c.id}
                    className={`pk-card status-borda-${c.status}`}
                  >
                    <div className="pk-card-topo">
                      <span className="pk-protocolo">{c.protocolo}</span>
                      {admin && c.agente_nome && (
                        <span className="pk-agente">{c.agente_nome}</span>
                      )}
                    </div>
                    <h3 className="pk-nome">{c.cliente_nome}</h3>
                    <p className="pk-linha">
                      Orlando{c.data_prevista_texto ? ` · ${c.data_prevista_texto}` : ''}
                    </p>
                    <p className="pk-linha pk-consultora">
                      Consultora: {c.consultora_nome ?? 'a definir'}
                    </p>
                    <div className="pk-rodape">
                      <span className="pk-quando">
                        {DATA.format(new Date(c.criado_em))}
                      </span>
                      {/* Mostra o valor sempre que houver: a agência pode
                          registrá-lo antes da consultoria fechar a venda. */}
                      {c.valor_total_venda != null && (
                        <span className="pk-valor">{reais(c.valor_total_venda)}</span>
                      )}
                    </div>
                  </Link>
                ))}
                {cards.length === 0 && <div className="pk-vazio">Nenhuma</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
