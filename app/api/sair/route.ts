import { NextResponse } from 'next/server';
import { fecharSessao } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  await fecharSessao();
  return NextResponse.redirect(new URL('/entrar', req.url));
}
