import { sql } from './db';
import { enviar } from './email';
import {
  briefingAgente,
  confirmacaoCliente,
  copiaEspecialista,
  type DadosBriefing,
} from './briefing';

/**
 * Processa a fila de envios.
 *
 * Chamado logo após o formulário ser recebido, e também por um agendamento
 * a cada poucos minutos para tratar as falhas.
 *
 * A trava é feita no próprio UPDATE: só pega quem ainda está pendente e
 * já marca como 'enviando' na mesma operação. Duas execuções simultâneas
 * não disputam a mesma linha.
 */

const MAX_TENTATIVAS = 4;
const LOTE = 20;

interface Pendente {
  id: string;
  solicitacao_id: string;
  tipo: string;
  destinatario: string;
  tentativas: number;
}

/**
 * Encerramento automático: um card que ficou 2 dias completos em Venda
 * Finalizada ou Venda Perdida vai para "Concluídas", mantendo o Kanban
 * limpo. Roda junto com o processamento da fila (cron).
 *
 * Age por CARD, não por solicitação: os dois pipelines têm relógios
 * próprios. O card da consultoria pode encerrar enquanto o da agência
 * ainda está em negociação — e é exatamente esse o comportamento
 * desejado, já que cada lado controla o seu.
 *
 * O evento só é registrado para o lado consultoria: no lado da agência
 * ele apareceria na linha do tempo dela como movimentação, e a agência
 * só deve ver o que ela mesma registrou.
 */
export async function encerrarAntigas(): Promise<number> {
  const movidas = await sql<{ solicitacao_id: string; lado: string }[]>`
    update cards
    set status = 'concluida', status_em = now()
    where status in ('venda_finalizada', 'venda_perdida')
      and status_em < now() - interval '2 days'
    returning solicitacao_id, lado::text
  `;

  const daConsultoria = movidas.filter((m) => m.lado === 'consultoria');
  if (daConsultoria.length > 0) {
    await sql`
      insert into eventos (solicitacao_id, tipo, descricao)
      select id, 'status_alterado',
             'Encerrada automaticamente (2 dias em venda finalizada/perdida)'
      from unnest(${daConsultoria.map((m) => m.solicitacao_id)}::uuid[]) as id
    `;
  }
  return movidas.length;
}

export async function processarFila(): Promise<{ enviados: number; falhas: number }> {
  // Encerramento automático roda mesmo sem provedor de e-mail configurado.
  await encerrarAntigas().catch((e) => console.error('[fila] encerrar antigas', e));

  if (!process.env.EMAIL_API_KEY) {
    console.warn('[fila] EMAIL_API_KEY ausente, nada a enviar');
    return { enviados: 0, falhas: 0 };
  }

  const pendentes = await sql<Pendente[]>`
    update envios_email
    set status = 'enviando', tentativas = tentativas + 1
    where id in (
      select id from envios_email
      where status in ('pendente', 'falha')
        and tentativas < ${MAX_TENTATIVAS}
        and destinatario <> ''
      order by criado_em
      limit ${LOTE}
      for update skip locked
    )
    returning id, solicitacao_id, tipo, destinatario, tentativas
  `;

  let enviados = 0;
  let falhas = 0;

  for (const p of pendentes) {
    try {
      const dados = await carregarDados(p.solicitacao_id);
      if (!dados) throw new Error('Solicitação não encontrada');

      // `aviso_especialista` (novo, um por especialista) e
      // `copia_especialista` (antigo, endereço único do .env) compartilham
      // o mesmo corpo: o que mudou foi a quem se endereça, não o que se
      // conta. O tipo antigo segue tratado porque pode haver envio pendente
      // dele na fila no momento da atualização.
      const base =
        p.tipo === 'briefing_agente'
          ? briefingAgente(dados)
          : p.tipo === 'confirmacao_cliente'
            ? confirmacaoCliente(dados)
            : copiaEspecialista(dados);

      const idProvedor = await enviar({ ...base, para: p.destinatario });

      await sql`
        update envios_email
        set status = 'enviado',
            provider = 'resend',
            provider_message_id = ${idProvedor},
            enviado_em = now(),
            erro = null
        where id = ${p.id}
      `;

      await sql`
        insert into eventos (solicitacao_id, tipo, descricao, payload)
        values (
          ${p.solicitacao_id}, 'email_disparado',
          ${`${p.tipo.replace(/_/g, ' ')} para ${p.destinatario}`},
          ${sql.json({ envio: p.id, provedor: idProvedor })}
        )
      `;
      enviados++;
    } catch (e: any) {
      falhas++;
      const desistiu = p.tentativas >= MAX_TENTATIVAS;
      const mensagem = String(e?.message ?? e).slice(0, 500);

      await sql`
        update envios_email
        set status = ${desistiu ? 'falha' : 'pendente'},
            erro = ${mensagem}
        where id = ${p.id}
      `;

      // Falha definitiva não pode passar em silêncio: o cartão passa a
      // exibir a tarja de e-mail não entregue no quadro da especialista.
      // A solicitação não muda de coluna: o cartão passa a exibir a tarja
      // "e-mail não entregue" e sobe na fila. O alerta continua existindo
      // sem embaralhar o quadro da especialista.
      if (desistiu) {
        await sql`
          insert into eventos (solicitacao_id, tipo, descricao)
          values (
            ${p.solicitacao_id}, 'email_bounce',
            ${`Não foi possível entregar para ${p.destinatario}: ${mensagem}`}
          )
        `;
      }
      console.error('[fila] falha no envio', p.id, mensagem);
    }
  }

  return { enviados, falhas };
}

async function carregarDados(id: string): Promise<DadosBriefing | null> {
  const [s] = await sql<any[]>`
    select
      s.protocolo, s.cliente_nome, s.cliente_email, s.cliente_whatsapp,
      s.data_prevista_texto, s.total_pessoas, s.total_criancas,
      s.completude, s.respostas, s.id,
      coalesce(a.nome, 'consultor')          as agente_nome,
      coalesce(ag.nome, 'sua agência')       as agencia_nome
    from solicitacoes s
    left join agentes  a  on a.id  = s.agente_id
    left join agencias ag on ag.id = s.agencia_id
    where s.id = ${id}
  `;
  if (!s) return null;

  const base = process.env.APP_URL?.replace(/\/$/, '');

  return {
    protocolo: s.protocolo,
    clienteNome: s.cliente_nome,
    clienteEmail: s.cliente_email,
    clienteWhatsapp: s.cliente_whatsapp,
    dataPrevistaTexto: s.data_prevista_texto,
    totalPessoas: s.total_pessoas,
    totalCriancas: s.total_criancas,
    completude: s.completude,
    respostas: s.respostas,
    agenteNome: s.agente_nome,
    agenciaNome: s.agencia_nome,
    urlPainel: base ? `${base}/painel/${s.id}` : undefined,
  };
}
