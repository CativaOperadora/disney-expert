import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sessaoValida } from '@/lib/auth';
import { STATUS, MOTIVOS_PERDA } from '@/lib/sla';

export const runtime = 'nodejs';

const STATUS_VALIDOS = STATUS.map((s) => s.id) as readonly string[];
const MOTIVOS_VALIDOS = MOTIVOS_PERDA.map((m) => m[0]) as readonly string[];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessaoValida())) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Identificador inválido.' }, { status: 400 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo?.acao) {
    return NextResponse.json({ erro: 'Ação ausente.' }, { status: 400 });
  }

  try {
    if (corpo.acao === 'status') {
      if (!STATUS_VALIDOS.includes(corpo.status)) {
        return NextResponse.json({ erro: 'Status inválido.' }, { status: 400 });
      }
      const motivo =
        corpo.status === 'venda_perdida' && MOTIVOS_VALIDOS.includes(corpo.motivo)
          ? corpo.motivo
          : corpo.status === 'venda_perdida'
            ? 'sem_retorno_agencia'
            : null;

      const [antes] = await sql<{ status: string }[]>`
        select status from solicitacoes where id = ${id}
      `;
      if (!antes) {
        return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
      }

      // Sair de "nova_solicitacao" pela primeira vez para o relógio do SLA.
      await sql`
        update solicitacoes
        set status = ${corpo.status}::status_solicitacao,
            motivo_perda = ${motivo}::motivo_perda,
            primeiro_atendimento_em = case
              when ${corpo.status} <> 'nova_solicitacao'
               and primeiro_atendimento_em is null then now()
              else primeiro_atendimento_em
            end
        where id = ${id}
      `;

      await sql`
        insert into eventos (solicitacao_id, tipo, descricao, payload)
        values (
          ${id}, 'status_alterado',
          ${`De ${antes.status} para ${corpo.status}`},
          ${sql.json({ de: antes.status, para: corpo.status, motivo })}
        )
      `;
      return NextResponse.json({ ok: true });
    }

    if (corpo.acao === 'comentario') {
      const texto = String(corpo.texto ?? '').trim().slice(0, 4000);
      if (texto.length < 2) {
        return NextResponse.json({ erro: 'Anotação vazia.' }, { status: 400 });
      }
      await sql`
        insert into eventos (solicitacao_id, tipo, descricao)
        values (${id}, 'comentario', ${texto})
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    console.error('[painel] falha na ação', e);
    return NextResponse.json({ erro: 'Falha ao salvar.' }, { status: 500 });
  }
}
