import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sessaoValida } from '@/lib/auth';

export const runtime = 'nodejs';

const STATUS_VALIDOS = [
  'novo', 'triagem', 'em_analise', 'consultoria_entregue',
  'com_agencia', 'follow_up', 'ganho', 'perdido',
];

const MOTIVOS_VALIDOS = [
  'sem_retorno_agencia', 'cliente_desistiu',
  'perdido_concorrencia', 'fora_de_perfil',
];

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
        corpo.status === 'perdido' && MOTIVOS_VALIDOS.includes(corpo.motivo)
          ? corpo.motivo
          : null;

      const [antes] = await sql<{ status: string }[]>`
        select status from solicitacoes where id = ${id}
      `;
      if (!antes) {
        return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
      }

      await sql`
        update solicitacoes
        set status = ${corpo.status}::status_solicitacao,
            motivo_perda = ${motivo}::motivo_perda
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
