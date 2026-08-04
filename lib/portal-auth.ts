import { cookies } from 'next/headers';
import { sql } from './db';

/**
 * Autenticação do Portal do Agente (multi-tenant).
 *
 * PRINCÍPIO DE ISOLAMENTO
 *   O cookie guarda apenas o id do agente, assinado com HMAC. Papel
 *   (admin), agência e status (ativo) NUNCA vêm do cookie: são recarregados
 *   do banco a cada requisição por `sessaoPortal()`. Assim, desativar um
 *   usuário ou trocar seu papel tem efeito imediato, e ninguém consegue
 *   forjar a própria agência ou virar admin adulterando o cookie.
 */

const COOKIE = 'portal_sessao';
const DURACAO_HORAS = 12;

function segredo() {
  const s = process.env.SESSAO_SECRET;
  if (!s || s.length < 16) throw new Error('SESSAO_SECRET ausente ou muito curta no .env');
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
  const bytes = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(dados));
  return Buffer.from(bytes).toString('base64url');
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export interface SessaoPortal {
  agenteId: string;
  nome: string;
  email: string;
  codigo: string;
  admin: boolean;
  agenciaId: string;
  agenciaNome: string;
  agenciaTier: string;
  foto: string | null;
  tema: string;
  celebracao: boolean;
}

/** Valida e-mail + senha, abre a sessão e devolve o usuário. */
export async function loginPortal(
  email: unknown,
  senha: unknown,
): Promise<SessaoPortal | null> {
  if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
    return null;
  }
  const [ag] = await sql<
    { id: string }[]
  >`
    select a.id
    from agentes a
    where a.email = ${email.trim()}
      and a.ativo
      and a.senha_hash is not null
      and a.senha_hash = crypt(${senha}, a.senha_hash)
    limit 1
  `;
  if (!ag) return null;

  await sql`update agentes set ultimo_acesso = now() where id = ${ag.id}`;

  const expira = Date.now() + DURACAO_HORAS * 3600_000;
  const base = `${ag.id}.${expira}`;
  const valor = `${base}.${await assinar(base)}`;
  (await cookies()).set(COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DURACAO_HORAS * 3600,
  });

  return carregar(ag.id);
}

export async function fecharSessaoPortal() {
  (await cookies()).delete(COOKIE);
}

/** Sessão atual, recarregada do banco. null se ausente, expirada ou inativa. */
export async function sessaoPortal(): Promise<SessaoPortal | null> {
  const bruto = (await cookies()).get(COOKIE)?.value;
  if (!bruto) return null;
  const [id, expira, assinatura] = bruto.split('.');
  if (!id || !expira || !assinatura) return null;
  if (Number(expira) < Date.now()) return null;
  if (!iguais(assinatura, await assinar(`${id}.${expira}`))) return null;
  return carregar(id);
}

async function carregar(agenteId: string): Promise<SessaoPortal | null> {
  const [a] = await sql<
    {
      id: string;
      nome: string;
      email: string;
      codigo: string;
      admin: boolean;
      agencia_id: string;
      agencia_nome: string;
      agencia_tier: string;
      foto: string | null;
      tema: string;
      celebracao: boolean;
    }[]
  >`
    select a.id, a.nome, a.email, a.codigo, a.admin,
           ag.id as agencia_id, ag.nome as agencia_nome, ag.tier as agencia_tier,
           a.foto, a.tema, a.celebracao
    from agentes a
    join agencias ag on ag.id = a.agencia_id
    where a.id = ${agenteId} and a.ativo and ag.ativa
    limit 1
  `;
  if (!a) return null;
  return {
    agenteId: a.id,
    nome: a.nome,
    email: a.email,
    codigo: a.codigo,
    admin: a.admin,
    agenciaId: a.agencia_id,
    agenciaNome: a.agencia_nome,
    agenciaTier: a.agencia_tier,
    foto: a.foto,
    tema: a.tema,
    celebracao: a.celebracao,
  };
}
