import { NextRequest, NextResponse } from 'next/server';
import { identidadeAtual } from '@/lib/sessao-atual';
import { lerPreferencias, salvarPerfil, salvarFoto, trocarSenha } from '@/lib/preferencias';
import { guardarFoto } from '@/lib/anexos';

export const runtime = 'nodejs';

/**
 * Preferências do usuário logado — CRM interno ou Portal.
 *
 * A identidade vem SEMPRE da sessão (lib/sessao-atual.ts). Nenhuma ação
 * aqui aceita id de usuário na requisição: não existe caminho para
 * alterar o perfil ou a senha de outra pessoa.
 */
export async function GET() {
  const eu = await identidadeAtual();
  if (!eu) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  const p = await lerPreferencias(eu.tabela, eu.id);
  return NextResponse.json({ preferencias: p, area: eu.area });
}

export async function POST(req: NextRequest) {
  const eu = await identidadeAtual();
  if (!eu) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });

  const tipo = req.headers.get('content-type') ?? '';

  // ---- foto (multipart) ----
  if (tipo.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const arquivo = form?.get('foto');

    if (form?.get('remover') === '1') {
      await salvarFoto(eu.tabela, eu.id, null);
      return NextResponse.json({ ok: true, foto: null });
    }
    if (!(arquivo instanceof File)) {
      return NextResponse.json({ erro: 'Nenhuma imagem enviada.' }, { status: 400 });
    }
    const r = await guardarFoto(arquivo);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 422 });
    await salvarFoto(eu.tabela, eu.id, r.nome);
    return NextResponse.json({ ok: true, foto: r.nome });
  }

  // ---- perfil e senha (json) ----
  const corpo = await req.json().catch(() => null);
  if (!corpo?.acao) {
    return NextResponse.json({ erro: 'Ação ausente.' }, { status: 400 });
  }

  try {
    if (corpo.acao === 'perfil') {
      const r = await salvarPerfil(eu.tabela, eu.id, {
        nome: typeof corpo.nome === 'string' ? corpo.nome : undefined,
        tema: typeof corpo.tema === 'string' ? corpo.tema : undefined,
        celebracao:
          typeof corpo.celebracao === 'boolean' ? corpo.celebracao : undefined,
      });
      return r.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ erro: r.erro }, { status: 422 });
    }

    if (corpo.acao === 'senha') {
      const r = await trocarSenha(
        eu.tabela,
        eu.id,
        String(corpo.atual ?? ''),
        String(corpo.nova ?? ''),
        String(corpo.confirmacao ?? ''),
      );
      return r.ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ erro: r.erro }, { status: 422 });
    }

    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    console.error('[preferencias]', e);
    return NextResponse.json({ erro: 'Falha ao salvar.' }, { status: 500 });
  }
}
