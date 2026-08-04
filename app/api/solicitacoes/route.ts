import { NextRequest, NextResponse } from 'next/server';
import { sql, resolverAgente } from '@/lib/db';
import {
  PERGUNTAS,
  VERSAO_FORMULARIO,
  perguntaVisivel,
  projetarColunas,
  calcularCompletude,
} from '@/lib/perguntas';
import { processarFila } from '@/lib/fila';
import { criarCards } from '@/lib/cards';
import { notificar, notificarEspecialistas } from '@/lib/notificacoes';

export const runtime = 'nodejs';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * Recebe o formulário preenchido.
 *
 * Ordem deliberada: valida, grava, e só então enfileira os envios.
 * Nada que possa falhar depois compromete o dado, porque ele já está
 * salvo quando o cliente recebe a confirmação na tela.
 */
export async function POST(req: NextRequest) {
  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Requisição inválida.' }, { status: 400 });
  }

  const { codigo, respostas } = corpo ?? {};
  if (typeof codigo !== 'string' || typeof respostas !== 'object' || !respostas) {
    return NextResponse.json({ erro: 'Dados incompletos.' }, { status: 400 });
  }

  // --- 1. o link precisa ter dono ------------------------------------
  const agente = await resolverAgente(codigo);
  if (!agente) {
    return NextResponse.json(
      { erro: 'Link não reconhecido. Peça um link novo à sua agência.' },
      { status: 404 },
    );
  }

  // --- 2. validação no servidor --------------------------------------
  // A validação do navegador é conveniência. Esta é a que vale.
  const faltando: string[] = [];
  for (const p of PERGUNTAS) {
    if (!p.obrigatoria || !perguntaVisivel(p, respostas)) continue;
    const v = respostas[p.id];
    const vazio =
      v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (p.tipo === 'aceite' && v !== true);
    if (vazio) faltando.push(p.id);
  }
  if (faltando.length > 0) {
    return NextResponse.json(
      { erro: 'Faltam respostas obrigatórias.', campos: faltando },
      { status: 422 },
    );
  }

  // Guarda apenas as chaves que existem na definição do formulário.
  const limpas: Record<string, any> = {};
  for (const p of PERGUNTAS) {
    if (respostas[p.id] !== undefined) limpas[p.id] = respostas[p.id];
  }

  // Descarta respostas de perguntas condicionais que não estão visíveis
  // para o conjunto informado (por exemplo, a data exata quando o cliente
  // escolheu informar só o período). Mantém o arquivo coerente com o que
  // foi exibido e evita que uma data antiga sobreponha a escolha atual.
  for (const p of PERGUNTAS) {
    if (limpas[p.id] !== undefined && !perguntaVisivel(p, limpas)) {
      delete limpas[p.id];
    }
  }

  // --- 3. projeção para as colunas consultáveis ----------------------
  const col = projetarColunas(limpas);
  const completude = calcularCompletude(limpas);

  // A data vai para a coluna `data_prevista` (tipo date) e para um texto
  // legível. Duas origens possíveis: o dia exato, quando o cliente já tem
  // data fechada, ou o mês previsto, quando ainda está decidindo.
  let dataPrevista: string | null = null;
  let dataTexto: string | null = null;
  if (typeof limpas.data_exata === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(limpas.data_exata)) {
    dataPrevista = limpas.data_exata;
    const [ano, mes, dia] = limpas.data_exata.split('-');
    dataTexto = `${dia} de ${MESES[Number(mes) - 1]} de ${ano}`;
  } else if (typeof limpas.data_prevista === 'string' && /^\d{4}-\d{2}$/.test(limpas.data_prevista)) {
    dataPrevista = `${limpas.data_prevista}-01`;
    const [ano, mes] = limpas.data_prevista.split('-');
    dataTexto = `${MESES[Number(mes) - 1]} de ${ano}`;
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // --- 4. gravação ----------------------------------------------------
  try {
    const [criada] = await sql<{ id: string; protocolo: string }[]>`
      insert into solicitacoes (
        agente_id, agencia_id, codigo_agente_informado,
        origem_url,
        cliente_nome, cliente_email, cliente_whatsapp,
        total_pessoas, total_criancas, primeira_viagem,
        data_prevista, data_prevista_texto, origem_embarque,
        dias_orlando, dias_parques, parques,
        respostas, versao_formulario,
        consentimento_lgpd, consentimento_ip, consentimento_em,
        aceite_marketing, aceite_marketing_em
      ) values (
        ${agente.agente_id}, ${agente.agencia_id}, ${codigo},
        ${req.headers.get('referer')},
        ${col.cliente_nome}, ${col.cliente_email}, ${col.cliente_whatsapp},
        ${col.total_pessoas}, ${col.total_criancas}, ${col.primeira_viagem},
        ${dataPrevista}, ${dataTexto}, ${col.origem_embarque},
        ${col.dias_orlando}, ${col.dias_parques}, ${col.parques},
        ${sql.json(limpas)}, ${VERSAO_FORMULARIO},
        ${col.consentimento_lgpd}, ${ip}, now(),
        ${col.aceite_marketing}, ${col.aceite_marketing ? sql`now()` : null}
      )
      returning id, protocolo
    `;

    // Os dois pipelines nascem juntos: consultoria e agência, cada um em
    // "Nova solicitação". A partir daqui evoluem de forma independente.
    await criarCards(criada.id);

    // Notifica a agência do lead que acabou de chegar. É evento DELA —
    // nada aqui vem do lado da consultoria.
    await notificar(
      criada.id,
      'solicitacao_nova',
      'Nova solicitação recebida',
      `${criada.protocolo} · ${col.cliente_nome}`,
    ).catch((e) => console.error('[solicitacoes] notificar', e));

    // E avisa a consultoria. Vai para TODAS as especialistas ativas: o card
    // nasce sem responsável (`criarCards`), então não há "a responsável" a
    // quem endereçar — quem pegar assume.
    await notificarEspecialistas(
      criada.id,
      'solicitacao_nova_interna',
      'Nova solicitação para atender',
      `${criada.protocolo} · ${col.cliente_nome} · ${agente.agencia_nome}`,
    ).catch((e) => console.error('[solicitacoes] notificar especialistas', e));

    await sql`
      insert into eventos (solicitacao_id, tipo, descricao, payload)
      values (
        ${criada.id}, 'criada',
        ${'Formulário recebido de ' + col.cliente_nome},
        ${sql.json({ codigo, completude, versao: VERSAO_FORMULARIO })}
      )
    `;

    await sql`
      update solicitacoes set completude = ${completude} where id = ${criada.id}
    `;

    // --- 5. fila de envios -------------------------------------------
    // A chave de idempotência tem índice único no banco. Se por qualquer
    // motivo esta rotina rodar de novo, o insert falha e nenhum e-mail
    // duplicado é enviado. A garantia é do banco, não do código.
    await sql`
      insert into envios_email (solicitacao_id, tipo, destinatario, idempotency_key)
      values
        (${criada.id}, 'briefing_agente',    ${agente.agente_email}, ${criada.id + ':briefing_agente'}),
        (${criada.id}, 'confirmacao_cliente', ${col.cliente_email},  ${criada.id + ':confirmacao_cliente'})
      on conflict (idempotency_key) do nothing
    `;

    // Aviso da consultoria: UMA linha por especialista ativa, com o
    // endereço vindo de `usuarios`. Substitui a cópia única que ia para o
    // EMAIL_ESPECIALISTA do .env — endereço genérico não diz a ninguém que
    // a solicitação é sua para atender.
    //
    // A chave de idempotência leva o id da pessoa: sem isso as duas linhas
    // colidiriam entre si e só a primeira entraria.
    //
    // Fora do insert acima de propósito: uma especialista sem e-mail, ou
    // nenhuma cadastrada, não pode impedir a confirmação do cliente. O
    // catch segue o mesmo padrão do `notificar` acima.
    await sql`
      insert into envios_email (solicitacao_id, tipo, destinatario, idempotency_key)
      select ${criada.id}, 'aviso_especialista', u.email,
             ${criada.id + ':aviso_especialista:'} || u.id::text
      from usuarios u
      where u.papel = 'especialista' and u.ativo and u.email <> ''
      on conflict (idempotency_key) do nothing
    `.catch((e) => console.error('[solicitacoes] aviso especialistas', e));

    // Dispara a fila sem segurar a resposta. O cliente já pode ver a tela
    // de conclusão: o dado está salvo e o envio acontece em seguida.
    // Se falhar aqui, a retentativa agendada resolve.
    processarFila().catch((e) => console.error('[solicitacoes] fila', e));

    return NextResponse.json({ protocolo: criada.protocolo }, { status: 201 });
  } catch (e) {
    console.error('[solicitacoes] falha ao gravar', e);
    return NextResponse.json(
      { erro: 'Não conseguimos registrar agora. Tente novamente.' },
      { status: 500 },
    );
  }
}
