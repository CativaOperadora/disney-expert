import { NextRequest, NextResponse } from 'next/server';
import { sessaoPortal } from '@/lib/portal-auth';
import { detalheSolicitacao } from '@/lib/portal';
import {
  listarSeguidores, candidatosASeguidor, adicionarSeguidor, removerSeguidor,
} from '@/lib/seguidores';

export const runtime = 'nodejs';

/**
 * Seguidores de um ticket.
 *
 * O acesso ao ticket é conferido por detalheSolicitacao(sess, id), que
 * aplica o escopo da sessão. Já a regra de "mesma agência" para quem pode
 * ser adicionado vive no SQL de lib/seguidores.ts.
 */
async function autorizado(sess: any, id: string) {
  return (await detalheSolicitacao(sess, id)) !== null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  if (!(await autorizado(sess, id))) {
    return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
  }

  const [seguidores, candidatos] = await Promise.all([
    listarSeguidores(id),
    candidatosASeguidor(sess, id),
  ]);
  return NextResponse.json({ seguidores, candidatos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const { id } = await params;
  if (!(await autorizado(sess, id))) {
    return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });
  }

  const corpo = await req.json().catch(() => ({}));
  const agenteId = String(corpo?.agenteId ?? '');
  const remover = corpo?.remover === true;

  if (remover) {
    const ok = await removerSeguidor(sess, id, agenteId);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ erro: 'Seguidor não encontrado.' }, { status: 404 });
  }

  const r = await adicionarSeguidor(sess, id, agenteId);
  return r.ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ erro: r.erro }, { status: 422 });
}
