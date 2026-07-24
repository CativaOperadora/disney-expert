import { NextRequest, NextResponse } from 'next/server';
import { conferirSenha, abrirSessao } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { senha } = await req.json().catch(() => ({}));

  // Atraso fixo: torna inútil tentar adivinhar por força bruta.
  await new Promise((r) => setTimeout(r, 400));

  if (!(await conferirSenha(senha))) {
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }
  await abrirSessao();
  return NextResponse.json({ ok: true });
}
