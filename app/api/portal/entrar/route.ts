import { NextRequest, NextResponse } from 'next/server';
import { loginPortal, fecharSessaoPortal } from '@/lib/portal-auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { email, senha, perfil } = await req.json().catch(() => ({}));

  // Atraso fixo: desestimula tentativa por força bruta.
  await new Promise((r) => setTimeout(r, 400));

  const sess = await loginPortal(email, senha);
  if (!sess) {
    return NextResponse.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  // O perfil escolhido na tela é conferido contra o papel real, que vem do
  // banco. Ele nunca CONCEDE acesso — no máximo recusa uma entrada pela
  // aba errada. Marcar "Administrador" numa conta de agente continua sem
  // dar nenhum poder extra: quem manda é sess.admin.
  if (perfil === 'admin' || perfil === 'agente') {
    const esperadoAdmin = perfil === 'admin';
    if (sess.admin !== esperadoAdmin) {
      // A sessão chegou a ser aberta por loginPortal; fecha antes de sair,
      // para não deixar cookie válido numa tentativa recusada.
      await fecharSessaoPortal();
      return NextResponse.json(
        {
          erro: sess.admin
            ? 'Esta conta é de Administrador da agência. Já selecionamos a opção correta — confirme para entrar.'
            : 'Esta conta é de Agente de Viagens. Já selecionamos a opção correta — confirme para entrar.',
          perfilCorreto: sess.admin ? 'admin' : 'agente',
        },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true, admin: sess.admin });
}
