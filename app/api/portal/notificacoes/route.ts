import { NextRequest, NextResponse } from 'next/server';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarNotificacoes, contarNaoLidas, marcarLidas } from '@/lib/notificacoes';

export const runtime = 'nodejs';

/**
 * Caixa de notificações do usuário logado.
 *
 * O destinatário vem SEMPRE da sessão — não existe parâmetro para ler a
 * caixa de outra pessoa, nem para marcar como lida o aviso de outro.
 *
 * O sino consulta esta rota periodicamente. Por isso ela é barata: o
 * contador é uma agregação sobre índice parcial, e a lista só desce
 * quando o usuário abre o painel.
 */
export async function GET(req: NextRequest) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const soContador = req.nextUrl.searchParams.get('contador') === '1';
  if (soContador) {
    return NextResponse.json(
      { naoLidas: await contarNaoLidas(sess) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [itens, naoLidas] = await Promise.all([
    listarNotificacoes(sess),
    contarNaoLidas(sess),
  ]);
  return NextResponse.json({ itens, naoLidas }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Marca como lidas: as informadas, ou todas se nenhuma for. */
export async function POST(req: NextRequest) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const corpo = await req.json().catch(() => ({}));
  const ids = Array.isArray(corpo?.ids)
    ? corpo.ids.map((i: unknown) => String(i))
    : undefined;

  const n = await marcarLidas(sess, ids);
  return NextResponse.json({ ok: true, marcadas: n });
}
