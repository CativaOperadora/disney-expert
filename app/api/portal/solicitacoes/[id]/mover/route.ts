import { NextRequest, NextResponse } from 'next/server';
import { sessaoPortal } from '@/lib/portal-auth';
import { moverCardAgencia } from '@/lib/cards';
import { STATUS } from '@/lib/sla';
import { notificar } from '@/lib/notificacoes';

export const runtime = 'nodejs';

const STATUS_VALIDOS = STATUS.map((s) => s.id) as readonly string[];

/**
 * Move o card da AGÊNCIA entre as etapas.
 *
 * Nunca toca no card da consultoria: os pipelines são independentes, e é
 * essa rota que garante a separação do lado do Portal.
 *
 * Diferente do CRM interno, aqui NÃO há motivo de perda. O agente arrasta
 * para "Venda perdida" e pronto — sem modal, por decisão de produto. A
 * constraint chk_motivo_perda_card só exige motivo no lado consultoria,
 * então a regra está no banco, não só nesta rota.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  const corpo = await req.json().catch(() => null);
  const status = String(corpo?.status ?? '');

  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ erro: 'Situação inválida.' }, { status: 400 });
  }

  try {
    // O escopo (agente move o próprio, admin move os da agência) é
    // aplicado dentro de moverCardAgencia, a partir da sessão.
    const ok = await moverCardAgencia(sess, id, status);
    if (!ok) return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });

    // Avisa o resto da agência: dono, administradores e seguidores. Quem
    // moveu não recebe aviso do que acabou de fazer.
    const rotulo = STATUS.find((s) => s.id === status)?.titulo ?? status;
    await notificar(
      id,
      status === 'venda_finalizada' ? 'venda_finalizada' : 'card_movido',
      status === 'venda_finalizada'
        ? 'Venda finalizada'
        : `Card movido para ${rotulo}`,
      `${sess.nome} · ${rotulo}`,
      sess.agenteId,
    ).catch((e) => console.error('[portal/mover] notificar', e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[portal/mover]', e);
    return NextResponse.json({ erro: 'Falha ao mover o card.' }, { status: 500 });
  }
}
