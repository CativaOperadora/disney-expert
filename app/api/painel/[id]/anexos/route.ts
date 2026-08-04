import { NextRequest, NextResponse } from 'next/server';
import { sessaoValida } from '@/lib/auth';
import { guardarAnexo, listarAnexos } from '@/lib/anexos';

export const runtime = 'nodejs';

/**
 * Upload de imagens do motivo da perda. Exclusivo do CRM interno: só a
 * especialista registra perda, então só esta sessão envia anexo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessaoValida())) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Identificador inválido.' }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get('arquivo');
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  try {
    const r = await guardarAnexo(id, arquivo);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 422 });
    return NextResponse.json({ ok: true, anexo: r.anexo });
  } catch (e) {
    console.error('[painel/anexos] falha ao guardar', e);
    return NextResponse.json({ erro: 'Falha ao enviar a imagem.' }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sessaoValida())) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ erro: 'Identificador inválido.' }, { status: 400 });
  }
  return NextResponse.json({ anexos: await listarAnexos(id) });
}
