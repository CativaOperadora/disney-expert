import { NextRequest, NextResponse } from 'next/server';
import { identidadeAtual } from '@/lib/sessao-atual';
import { lerFoto } from '@/lib/anexos';

export const runtime = 'nodejs';

/**
 * Entrega uma foto de perfil.
 *
 * Exige sessão (qualquer uma das duas áreas): fotos ficam fora de
 * public/ pelo mesmo motivo dos anexos — lá o Next as serviria sem
 * checar nada. Dentro do sistema, a foto de um colega é visível, o que é
 * o esperado num CRM.
 *
 * O nome do arquivo é validado por formato em lerFoto(), então não há
 * como pedir "../../.env" por esta rota.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nome: string }> },
) {
  if (!(await identidadeAtual())) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const { nome } = await params;
  const foto = await lerFoto(nome);
  if (!foto) return NextResponse.json({ erro: 'Não encontrada.' }, { status: 404 });

  return new NextResponse(new Uint8Array(foto.bytes), {
    status: 200,
    headers: {
      'Content-Type': foto.mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
