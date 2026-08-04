import { NextRequest, NextResponse } from 'next/server';
import { loginPainel } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json().catch(() => ({}));

  // Atraso fixo: torna inútil tentar adivinhar por força bruta.
  await new Promise((r) => setTimeout(r, 400));

  // E-mail vazio cai no acesso de emergência por PAINEL_SENHA, enquanto
  // a variável existir no .env. Ver lib/auth.ts.
  const sess = await loginPainel(email, senha);
  if (!sess) {
    return NextResponse.json(
      { erro: 'E-mail ou senha incorretos.' },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, nome: sess.nome });
}
