import { NextRequest, NextResponse } from 'next/server';
import { fecharSessaoPortal } from '@/lib/portal-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await fecharSessaoPortal();
  return NextResponse.redirect(new URL('/portal/entrar', req.url));
}
