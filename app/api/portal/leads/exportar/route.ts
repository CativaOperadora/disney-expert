import { NextRequest, NextResponse } from 'next/server';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarLeads, type FiltroLeads } from '@/lib/leads';
import { gerarCsv, nomeArquivo } from '@/lib/csv';
import { formatarBRL } from '@/lib/valores';

export const runtime = 'nodejs';

const DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});
const dia = (v: string | null) => (v ? DATA.format(new Date(v)) : '');

const CABECALHOS = [
  'Nome',
  'E-mail',
  'WhatsApp',
  'Cidade de origem',
  'Aceita campanha',
  'Data do aceite',
  'Solicitacoes',
  'Primeiro contato',
  'Ultimo contato',
  'Situacao atual',
  'Periodo da viagem',
  'Viajantes',
  'Primeira viagem',
  'Parques de interesse',
  'Vendas',
  'Faturamento (R$)',
  'Agente responsavel',
];

/**
 * Exporta a base de leads em CSV.
 *
 * O recorte vem de `listarLeads(sess, ...)`, que aplica o escopo da sessão
 * — nunca da requisição. Um agente exporta só o que captou; o admin, a
 * agência inteira. Não existe parâmetro capaz de ampliar isso.
 */
export async function POST(req: NextRequest) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const corpo = await req.json().catch(() => ({}));

  const filtros: FiltroLeads = {
    busca: typeof corpo?.busca === 'string' ? corpo.busca : null,
    status: typeof corpo?.status === 'string' && corpo.status ? corpo.status : null,
    de: /^\d{4}-\d{2}-\d{2}$/.test(corpo?.de ?? '') ? corpo.de : null,
    ate: /^\d{4}-\d{2}-\d{2}$/.test(corpo?.ate ?? '') ? corpo.ate : null,
    somenteMarketing: corpo?.somenteMarketing === true,
  };

  try {
    let leads = await listarLeads(sess, filtros, 20_000);

    // Seleção manual na tela: restringe ao subconjunto marcado. Nunca
    // amplia — é sempre uma interseção com o que a sessão já podia ver.
    if (Array.isArray(corpo?.emails) && corpo.emails.length > 0) {
      const escolhidos = new Set(
        corpo.emails
          .filter((e: unknown) => typeof e === 'string')
          .map((e: string) => e.toLowerCase()),
      );
      leads = leads.filter((l) => escolhidos.has(l.email.toLowerCase()));
    }

    const linhas = leads.map((l) => [
      l.nome,
      l.email,
      l.whatsapp,
      l.cidade,
      l.marketing ? 'Sim' : 'Nao',
      dia(l.marketing_em),
      l.solicitacoes,
      dia(l.primeiro_em),
      dia(l.ultimo_em),
      l.ultimo_status_rotulo,
      l.periodo,
      l.total_pessoas,
      l.primeira_viagem === null ? '' : l.primeira_viagem ? 'Sim' : 'Nao',
      l.parques,
      l.vendas,
      l.faturamento > 0 ? formatarBRL(l.faturamento) : '',
      l.agente_nome,
    ]);

    const csv = gerarCsv(CABECALHOS, linhas);
    const arquivo = nomeArquivo(
      `leads-${sess.agenciaNome}-${new Date().toISOString().slice(0, 10)}`,
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${arquivo}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[portal/leads/exportar]', e);
    return NextResponse.json({ erro: 'Falha ao gerar a planilha.' }, { status: 500 });
  }
}
