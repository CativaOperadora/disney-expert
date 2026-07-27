import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sessaoValida } from '@/lib/auth';
import { STATUS, MOTIVOS_PERDA } from '@/lib/sla';

export const runtime = 'nodejs';

const STATUS_VALIDOS = STATUS.map((s) => s.id) as readonly string[];
const MOTIVOS_VALIDOS = MOTIVOS_PERDA.map((m) => m[0]) as readonly string[];

/** Converte "R$ 12.500,00", "12500", "12.500,00" ou número em reais. */
function paraReais(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d,.-]/g, '').trim();
  if (!s) return null;
  // Formato brasileiro: ponto de milhar e vírgula decimal.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
      // Motivo é obrigatório ao mover para Venda perdida.
      if (corpo.status === 'venda_perdida' && !MOTIVOS_VALIDOS.includes(corpo.motivo)) {
        return NextResponse.json({ erro: 'Informe o motivo da perda.' }, { status: 422 });
      }
      const motivo = corpo.status === 'venda_perdida' ? corpo.motivo : null;

      // Consultora responsável (opcional; enviado ao mover para uma coluna
      // de consultoria). Vazio mantém a atribuição atual.
      const novoResp = /^[0-9a-f-]{36}$/i.test(String(corpo.responsavel ?? ''))
        ? corpo.responsavel
        : null;

      const [antes] = await sql<{ status: string; valor_total_venda: string | null }[]>`
        select status, valor_total_venda from solicitacoes where id = ${id}
      `;
      if (!antes) {
        return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
      }

      // O valor da venda é obrigatório para fechar. Aceita o valor enviado
      // junto com a ação ou um já gravado antes.
      let valorVenda: number | null =
        antes.valor_total_venda !== null ? Number(antes.valor_total_venda) : null;
      if (corpo.status === 'venda_finalizada') {
        const informado = paraReais(corpo.valor);
        if (informado !== null) valorVenda = informado;
        if (valorVenda === null || valorVenda <= 0) {
          return NextResponse.json(
            { erro: 'Informe o valor total da venda para marcar como finalizada.' },
            { status: 422 },
          );
        }
      }

      // Sair de "nova_solicitacao" liga o relógio do SLA; entrar em
      // "venda_finalizada" carimba a data da venda (base do faturamento).
      await sql`
        update solicitacoes
        set status = ${corpo.status}::status_solicitacao,
            motivo_perda = ${motivo}::motivo_perda,
            valor_total_venda = ${valorVenda},
            responsavel_id = coalesce(${novoResp}::uuid, responsavel_id),
            status_em = case when status <> ${corpo.status}::status_solicitacao then now() else status_em end,
            primeiro_atendimento_em = case
              when ${corpo.status} <> 'nova_solicitacao'
               and primeiro_atendimento_em is null then now()
              else primeiro_atendimento_em
            end,
            venda_em = case
              when ${corpo.status} = 'venda_finalizada' and venda_em is null then now()
              else venda_em
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

    if (corpo.acao === 'id_reserva') {
      // Campo interno da especialista. Texto simples, editável a qualquer
      // momento; vazio limpa o valor.
      const valor = String(corpo.valor ?? '').trim().slice(0, 120);
      await sql`
        update solicitacoes set id_reserva = ${valor || null} where id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (corpo.acao === 'valor_venda') {
      // Valor da venda editável a qualquer momento (base dos indicadores
      // financeiros). Vazio limpa o valor.
      const bruto = String(corpo.valor ?? '').trim();
      const valor = bruto === '' ? null : paraReais(bruto);
      if (bruto !== '' && valor === null) {
        return NextResponse.json({ erro: 'Valor inválido.' }, { status: 400 });
      }
      await sql`
        update solicitacoes set valor_total_venda = ${valor} where id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    if (corpo.acao === 'responsavel') {
      // Consultora responsável pelo atendimento. Alimenta os rankings por
      // consultora no BI. Vazio desatribui.
      const valor = String(corpo.valor ?? '').trim();
      if (valor !== '' && !/^[0-9a-f-]{36}$/i.test(valor)) {
        return NextResponse.json({ erro: 'Responsável inválido.' }, { status: 400 });
      }
      await sql`
        update solicitacoes set responsavel_id = ${valor || null} where id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    console.error('[painel] falha na ação', e);
    return NextResponse.json({ erro: 'Falha ao salvar.' }, { status: 500 });
  }
}
