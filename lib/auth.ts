import { cookies } from 'next/headers';

/**
 * Autenticação do painel interno.
 *
 * Senha única compartilhada, adequada para uma ou duas pessoas atrás de
 * HTTPS. O cookie guarda uma assinatura HMAC com validade, não a senha.
 *
 * Quando o time crescer, isto vira login por pessoa com a tabela usuarios
 * que já existe no banco. A troca fica contida neste arquivo.
 */

const COOKIE = 'painel_sessao';
const DURACAO_HORAS = 12;

function segredo() {
  const s = process.env.SESSAO_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSAO_SECRET ausente ou muito curta no .env');
  }
  return s;
}

async function assinar(dados: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    chave,
    new TextEncoder().encode(dados),
  );
  return Buffer.from(bytes).toString('base64url');
}

/** Compara sem vazar informação pelo tempo de execução. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function conferirSenha(senha: unknown): Promise<boolean> {
  const esperada = process.env.PAINEL_SENHA;
  if (!esperada || typeof senha !== 'string') return false;
  return iguais(
    await assinar('senha:' + senha),
    await assinar('senha:' + esperada),
  );
}

export async function abrirSessao() {
  const expira = Date.now() + DURACAO_HORAS * 3600_000;
  const valor = `${expira}.${await assinar(String(expira))}`;
  (await cookies()).set(COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_HORAS * 3600,
  });
}

export async function fecharSessao() {
  (await cookies()).delete(COOKIE);
}

export async function sessaoValida(): Promise<boolean> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return false;
  const [expira, assinatura] = bruto.split('.');
  if (!expira || !assinatura) return false;
  if (Number(expira) < Date.now()) return false;
  return iguais(assinatura, await assinar(expira));
}
