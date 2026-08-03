import { NextRequest, NextResponse } from 'next/server';
import { sessaoPortal } from '@/lib/portal-auth';
import { atualizarVendaPortal } from '@/lib/portal';
import { paraReais } from '@/lib/valores';

export const runtime = 'nodejs';

/**
 * Edição dos dados de venda pelo Portal do Agente.
 *
 * Escopo deliberadamente estreito: só `valor_venda` e `id_reserva`. Situação
 * do atendimento, responsável e motivo de perda continuam exclusivos do CRM
 * interno (/api/painel/[id]).
 *
 * O isolamento multi-tenant não é checado aqui: fica em
 * `atualizarVendaPortal`, que aplica o escopo da sessão dentro do próprio
 * UPDATE. Id de outra agência simplesmente não encontra linha.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Identificador inválido.' }, { status: 400 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo?.acao) return NextResponse.json({ erro: 'Ação ausente.' }, { status: 400 });

  try {
    if (corpo.acao === 'valor_venda') {
      const bruto = String(corpo.valor ?? '').trim();
      const valor = bruto === '' ? null : paraReais(bruto);
      if (bruto !== '' && valor === null) {
        return NextResponse.json({ erro: 'Valor inválido.' }, { status: 400 });
      }
      const ok = await atualizarVendaPortal(sess, id, 'valor_total_venda', valor);
      if (!ok) return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (corpo.acao === 'id_reserva') {
      const valor = String(corpo.valor ?? '').trim().slice(0, 120);
      const ok = await atualizarVendaPortal(sess, id, 'id_reserva', valor || null);
      if (!ok) return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    console.error('[portal/solicitacoes] falha na ação', e);
    return NextResponse.json({ erro: 'Falha ao salvar.' }, { status: 500 });
  }
}
