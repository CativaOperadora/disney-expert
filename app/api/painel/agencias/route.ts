import { NextRequest, NextResponse } from 'next/server';
import { sessaoValida } from '@/lib/auth';
import { criarAgencia, ativarAgencia } from '@/lib/superadmin';

export const runtime = 'nodejs';

// Nível super-admin: exige a sessão do CRM interno (equipe Cativa).
export async function POST(req: NextRequest) {
  if (!(await sessaoValida())) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo?.acao) return NextResponse.json({ erro: 'Ação ausente.' }, { status: 400 });

  if (corpo.acao === 'criar') {
    const r = await criarAgencia({
      nomeAgencia: corpo.nomeAgencia,
      tier: corpo.tier === 'select' ? 'select' : 'padrao',
      nomeAdmin: corpo.nomeAdmin,
      emailAdmin: corpo.emailAdmin,
      senha: corpo.senha,
    });
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
    return NextResponse.json({ ok: true, agenciaId: r.agenciaId, codigo: r.codigo });
  }

  if (corpo.acao === 'ativar') {
    const ok = await ativarAgencia(String(corpo.id ?? ''), corpo.ativa === true);
    if (!ok) return NextResponse.json({ erro: 'Agência não encontrada.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
}
