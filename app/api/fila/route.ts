import { NextRequest, NextResponse } from 'next/server';
import { processarFila } from '@/lib/fila';
import { sessaoValida } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Dispara a fila manualmente ou por agendamento.
 *
 *   curl -X POST https://SEU_DOMINIO/api/fila -H "x-segredo: $FILA_SEGREDO"
 *
 * Aceita também quem já está autenticado no painel, o que permite
 * reprocessar pelo navegador durante os testes.
 */
export async function POST(req: NextRequest) {
  const segredo = process.env.FILA_SEGREDO;
  const cabecalho = req.headers.get('x-segredo');

  const autorizado =
    (segredo && cabecalho === segredo) || (await sessaoValida());

  if (!autorizado) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  }

  const resultado = await processarFila();
  return NextResponse.json(resultado);
}
