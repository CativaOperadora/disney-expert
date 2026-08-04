import { cookies } from 'next/headers';
import { sql } from './db';

/**
 * Autenticação do CRM interno (equipe Cativa).
 *
 * MUDANÇA NA 013 — antes era UMA senha compartilhada. Agora cada pessoa
 * tem credencial própria na tabela `usuarios`, o que destrava
 * preferências, notificações e auditoria de quem fez o quê.
 *
 * PRINCÍPIO DE ISOLAMENTO (o mesmo do Portal)
 *   O cookie guarda apenas o id do usuário, assinado com HMAC. Papel e
 *   status (ativo) NUNCA vêm do cookie: são recarregados do banco a cada
 *   requisição. Desativar alguém tem efeito imediato e ninguém forja o
 *   próprio papel adulterando o cookie.
 *
 * ACESSO DE EMERGÊNCIA
 *   PAINEL_SENHA continua aceita enquanto existir no .env, para a
 *   transição não trancar ninguém do lado de fora. Ela abre uma sessão
 *   SEM usuário associado — quem entra assim não tem preferências nem
 *   notificações, só o acesso operacional. Remova a variável do .env
 *   depois que todos tiverem senha pessoal.
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

export interface SessaoPainel {
  /** null quando a entrada foi pela senha de emergência. */
  usuarioId: string | null;
  nome: string;
  email: string | null;
  papel: string;
  foto: string | null;
  tema: string;
  celebracao: boolean;
}

/** Marcador de sessão aberta pela senha compartilhada. */
const EMERGENCIA = 'compartilhada';

async function gravarCookie(assunto: string) {
  const expira = Date.now() + DURACAO_HORAS * 3600_000;
  const base = `${assunto}.${expira}`;
  const valor = `${base}.${await assinar(base)}`;
  (await cookies()).set(COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_HORAS * 3600,
  });
}

/**
 * Entra por e-mail + senha pessoal, ou só pela senha compartilhada
 * (campo de e-mail vazio), enquanto PAINEL_SENHA existir.
 */
export async function loginPainel(
  email: unknown,
  senha: unknown,
): Promise<SessaoPainel | null> {
  if (typeof senha !== 'string' || senha === '') return null;

  const usarEmail = typeof email === 'string' && email.trim() !== '';

  if (usarEmail) {
    const [u] = await sql<{ id: string }[]>`
      select id from usuarios
      where email = ${String(email).trim()}
        and ativo
        and senha_hash is not null
        and senha_hash = crypt(${senha}, senha_hash)
      limit 1
    `;
    if (!u) return null;
    await sql`update usuarios set ultimo_acesso = now() where id = ${u.id}`;
    await gravarCookie(u.id);
    return carregar(u.id);
  }

  // Acesso de emergência.
  const esperada = process.env.PAINEL_SENHA;
  if (!esperada) return null;
  if (!iguais(await assinar('senha:' + senha), await assinar('senha:' + esperada))) {
    return null;
  }
  await gravarCookie(EMERGENCIA);
  return sessaoEmergencia();
}

function sessaoEmergencia(): SessaoPainel {
  return {
    usuarioId: null,
    nome: 'Equipe Cativa',
    email: null,
    papel: 'especialista',
    foto: null,
    tema: 'sistema',
    celebracao: true,
  };
}

async function carregar(usuarioId: string): Promise<SessaoPainel | null> {
  const [u] = await sql<
    {
      id: string; nome: string; email: string; papel: string;
      foto: string | null; tema: string; celebracao: boolean;
    }[]
  >`
    select id, nome, email::text, papel::text, foto, tema, celebracao
    from usuarios where id = ${usuarioId} and ativo limit 1
  `;
  if (!u) return null;
  return {
    usuarioId: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    foto: u.foto,
    tema: u.tema,
    celebracao: u.celebracao,
  };
}

export async function fecharSessao() {
  (await cookies()).delete(COOKIE);
}

/** Sessão atual, recarregada do banco. null se ausente, expirada ou inativa. */
export async function sessaoPainel(): Promise<SessaoPainel | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  const [assunto, expira, assinatura] = bruto.split('.');
  if (!assunto || !expira || !assinatura) return null;
  if (Number(expira) < Date.now()) return null;
  if (!iguais(assinatura, await assinar(`${assunto}.${expira}`))) return null;

  if (assunto === EMERGENCIA) {
    // Se a variável foi removida do .env, as sessões de emergência caem.
    return process.env.PAINEL_SENHA ? sessaoEmergencia() : null;
  }
  return carregar(assunto);
}

/** Compatibilidade: muitas rotas só precisam saber se há sessão válida. */
export async function sessaoValida(): Promise<boolean> {
  return (await sessaoPainel()) !== null;
}
