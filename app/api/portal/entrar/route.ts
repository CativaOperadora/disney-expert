import { NextRequest, NextResponse } from 'next/server';
import { loginPortal } from '@/lib/portal-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}));

  // Atraso fixo: desestimula tentativa por força bruta.
  await new Promise((r) => setTimeout(r, 400));

  const sess = await loginPortal(email, senha);
  if (!sess) {
    return NextResponse.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, admin: sess.admin });
}
