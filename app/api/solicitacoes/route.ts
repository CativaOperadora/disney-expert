import { NextRequest, NextResponse } from 'next/server';
import { sql, resolverAgente } from '@/lib/db';
import {
  PERGUNTAS,
  VERSAO_FORMULARIO,
  perguntaVisivel,
  projetarColunas,
  calcularCompletude,
} from '@/lib/perguntas';

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

  // --- 3. projeção para as colunas consultáveis ----------------------
  const col = projetarColunas(limpas);
  const completude = calcularCompletude(limpas);

  // "2027-07" vira data e texto legível
  let dataPrevista: string | null = null;
  let dataTexto: string | null = null;
  if (typeof limpas.data_prevista === 'string' && /^\d{4}-\d{2}$/.test(limpas.data_prevista)) {
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
        consentimento_lgpd, consentimento_ip, consentimento_em
      ) values (
        ${agente.agente_id}, ${agente.agencia_id}, ${codigo},
        ${req.headers.get('referer')},
        ${col.cliente_nome}, ${col.cliente_email}, ${col.cliente_whatsapp},
        ${col.total_pessoas}, ${col.total_criancas}, ${col.primeira_viagem},
        ${dataPrevista}, ${dataTexto}, ${col.origem_embarque},
        ${col.dias_orlando}, ${col.dias_parques}, ${col.parques},
        ${sql.json(limpas)}, ${VERSAO_FORMULARIO},
        ${col.consentimento_lgpd}, ${ip}, now()
      )
      returning id, protocolo
    `;

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
        (${criada.id}, 'briefing_agente',    ${agente.agente_email},                  ${criada.id + ':briefing_agente'}),
        (${criada.id}, 'confirmacao_cliente', ${col.cliente_email},                    ${criada.id + ':confirmacao_cliente'}),
        (${criada.id}, 'copia_especialista',  ${process.env.EMAIL_ESPECIALISTA ?? ''}, ${criada.id + ':copia_especialista'})
      on conflict (idempotency_key) do nothing
    `;

    return NextResponse.json({ protocolo: criada.protocolo }, { status: 201 });
  } catch (e) {
    console.error('[solicitacoes] falha ao gravar', e);
    return NextResponse.json(
      { erro: 'Não conseguimos registrar agora. Tente novamente.' },
      { status: 500 },
    );
  }
}
