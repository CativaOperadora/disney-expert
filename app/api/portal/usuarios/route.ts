import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { sessaoPortal } from '@/lib/portal-auth';

export const runtime = 'nodejs';

const EMAIL_OK = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export async function POST(req: NextRequest) {
  const sess = await sessaoPortal();
  if (!sess) return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 });
  if (!sess.admin) {
    return NextResponse.json({ erro: 'Apenas o administrador da agência.' }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null);
  if (!corpo?.acao) return NextResponse.json({ erro: 'Ação ausente.' }, { status: 400 });

  try {
    // ---- criar usuário na PRÓPRIA agência ----
    if (corpo.acao === 'criar') {
      const nome = String(corpo.nome ?? '').trim();
      const email = String(corpo.email ?? '').trim();
      const senha = String(corpo.senha ?? '');
      const admin = corpo.admin === true;
      if (nome.length < 2) return NextResponse.json({ erro: 'Informe o nome.' }, { status: 400 });
      if (!EMAIL_OK(email)) return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
      if (senha.length < 6) return NextResponse.json({ erro: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });

      const [ja] = await sql<{ id: string }[]>`
        select id from agentes where email = ${email} and ativo limit 1`;
      if (ja) return NextResponse.json({ erro: 'Já existe um usuário ativo com este e-mail.' }, { status: 409 });

      const [novo] = await sql<{ id: string }[]>`
        insert into agentes (agencia_id, codigo, nome, email, admin, senha_hash)
        values (
          ${sess.agenciaId},
          'AG' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
          ${nome}, ${email}, ${admin}, crypt(${senha}, gen_salt('bf'))
        )
        returning id`;
      return NextResponse.json({ ok: true, id: novo.id });
    }

    // ---- editar (nome / e-mail / papel) ----
    if (corpo.acao === 'editar') {
      const id = String(corpo.id ?? '');
      const nome = String(corpo.nome ?? '').trim();
      const email = String(corpo.email ?? '').trim();
      const admin = corpo.admin === true;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
      if (nome.length < 2 || !EMAIL_OK(email)) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 });
      // Não permitir que o admin remova o próprio acesso de administrador.
      if (id === sess.agenteId && !admin) {
        return NextResponse.json({ erro: 'Você não pode remover o seu próprio acesso de administrador.' }, { status: 400 });
      }
      const [outro] = await sql<{ id: string }[]>`
        select id from agentes where email = ${email} and ativo and id <> ${id} limit 1`;
      if (outro) return NextResponse.json({ erro: 'Outro usuário ativo já usa este e-mail.' }, { status: 409 });

      const upd = await sql`
        update agentes set nome = ${nome}, email = ${email}, admin = ${admin}
        where id = ${id} and agencia_id = ${sess.agenciaId}`;
      if (upd.count === 0) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    // ---- ativar / desativar ----
    if (corpo.acao === 'ativar') {
      const id = String(corpo.id ?? '');
      const ativo = corpo.ativo === true;
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
      if (id === sess.agenteId && !ativo) {
        return NextResponse.json({ erro: 'Você não pode desativar o seu próprio acesso.' }, { status: 400 });
      }
      const upd = await sql`
        update agentes set ativo = ${ativo}
        where id = ${id} and agencia_id = ${sess.agenciaId}`;
      if (upd.count === 0) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    // ---- redefinir senha ----
    if (corpo.acao === 'senha') {
      const id = String(corpo.id ?? '');
      const senha = String(corpo.senha ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: 'Id inválido.' }, { status: 400 });
      if (senha.length < 6) return NextResponse.json({ erro: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 });
      const upd = await sql`
        update agentes set senha_hash = crypt(${senha}, gen_salt('bf'))
        where id = ${id} and agencia_id = ${sess.agenciaId}`;
      if (upd.count === 0) return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    console.error('[portal/usuarios]', e);
    return NextResponse.json({ erro: 'Falha ao salvar.' }, { status: 500 });
  }
}
