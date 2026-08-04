import { NextRequest, NextResponse } from 'next/server';
import { sessaoValida } from '@/lib/auth';
import { sessaoPortal } from '@/lib/portal-auth';
import { detalheSolicitacao } from '@/lib/portal';
import { lerAnexo } from '@/lib/anexos';

export const runtime = 'nodejs';

/**
 * Entrega de um anexo.
 *
 * É a única porta para o conteúdo dos arquivos — por isso os binários
 * ficam fora de public/, onde o Next os serviria sem checar nada.
 *
 * Duas sessões podem ver um anexo:
 *   · CRM interno  — vê qualquer solicitação;
 *   · Portal       — só se a solicitação estiver no escopo da sessão, o
 *                    que é decidido por detalheSolicitacao(sess, id).
 *
 * Um agente que adivinhe o uuid de um anexo de outra agência recebe 404,
 * indistinguível de inexistente.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anexo = await lerAnexo(id);
  if (!anexo) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  let liberado = await sessaoValida();

  if (!liberado) {
    const sess = await sessaoPortal();
    if (sess) {
      liberado = (await detalheSolicitacao(sess, anexo.solicitacaoId)) !== null;
    }
  }

  if (!liberado) {
    return NextResponse.json({ erro: 'Não encontrado.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(anexo.bytes), {
    status: 200,
    headers: {
      // O mime foi determinado pelos bytes na gravação, não pelo cliente.
      'Content-Type': anexo.mime,
      // Impede o navegador de "adivinhar" outro tipo e executar o conteúdo.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${anexo.nome.replace(/[^\w.\- ]/g, '_')}"`,
      // Privado: nunca em cache compartilhado, para não vazar entre sessões.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
