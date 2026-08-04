import { NextRequest, NextResponse } from 'next/server';
import { sessaoPainel } from '@/lib/auth';
import {
  listarNotificacoesInternas,
  contarNaoLidasInternas,
  marcarLidasInternas,
} from '@/lib/notificacoes';

export const runtime = 'nodejs';

/**
 * Caixa de notificações da equipe interna (CRM).
 *
 * Espelha `/api/portal/notificacoes`, com duas diferenças que importam:
 *
 *   · o destinatário sai de `sessaoPainel()`, não de `sessaoPortal()`;
 *   · sessão de emergência (senha compartilhada) não tem caixa. Ela abre
 *     acesso SEM usuário associado, então não há a quem endereçar nem de
 *     quem ler. Devolve vazio em vez de erro: o sino simplesmente não
 *     aparece, e nada quebra na tela de quem entrou assim.
 *
 * Como no Portal, não existe parâmetro de destinatário — ninguém lê a
 * caixa de outra pessoa nem marca como lido o aviso de outro.
 */
export async function GET(req: NextRequest) {
  const sess = await sessaoPainel();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const semCaixa = { headers: { 'Cache-Control': 'no-store' } };
  if (!sess.usuarioId) {
    return NextResponse.json({ itens: [], naoLidas: 0 }, semCaixa);
  }

  const soContador = req.nextUrl.searchParams.get('contador') === '1';
  if (soContador) {
    return NextResponse.json(
      { naoLidas: await contarNaoLidasInternas(sess.usuarioId) },
      semCaixa,
    );
  }

  const [itens, naoLidas] = await Promise.all([
    listarNotificacoesInternas(sess.usuarioId),
    contarNaoLidasInternas(sess.usuarioId),
  ]);
  return NextResponse.json({ itens, naoLidas }, semCaixa);
}

/** Marca como lidas: as informadas, ou todas se nenhuma for. */
export async function POST(req: NextRequest) {
  const sess = await sessaoPainel();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  if (!sess.usuarioId) return NextResponse.json({ ok: true, marcadas: 0 });

  const corpo = await req.json().catch(() => ({}));
  const ids = Array.isArray(corpo?.ids)
    ? corpo.ids.map((i: unknown) => String(i))
    : undefined;

  const n = await marcarLidasInternas(sess.usuarioId, ids);
  return NextResponse.json({ ok: true, marcadas: n });
}
