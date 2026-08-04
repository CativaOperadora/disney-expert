import { sql } from './db';
import { avaliarSenha } from './senha';

/**
 * Preferências de usuário.
 *
 * Existem DUAS tabelas de pessoa no sistema: `usuarios` (equipe Cativa) e
 * `agentes` (pessoal das agências). As colunas de preferência são as
 * mesmas nas duas, então este módulo recebe a tabela como parâmetro em
 * vez de duplicar tudo.
 *
 * A tabela NUNCA vem da requisição — quem chama já sabe qual sessão está
 * ativa. Um valor vindo de fora aqui seria injeção de identificador.
 */

export type Tabela = 'usuarios' | 'agentes';
export type Tema = 'claro' | 'escuro' | 'sistema';

const TABELAS: Record<Tabela, true> = { usuarios: true, agentes: true };
const TEMAS: Tema[] = ['claro', 'escuro', 'sistema'];

function conferirTabela(t: Tabela) {
  if (!TABELAS[t]) throw new Error('Tabela de usuário inválida.');
}

export interface Preferencias {
  nome: string;
  email: string;
  foto: string | null;
  tema: Tema;
  celebracao: boolean;
}

export async function lerPreferencias(
  tabela: Tabela,
  id: string,
): Promise<Preferencias | null> {
  conferirTabela(tabela);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await sql<Preferencias[]>`
    select nome, email::text, foto, tema, celebracao
    from ${sql(tabela)} where id = ${id} limit 1`;
  return p ?? null;
}

export async function salvarPerfil(
  tabela: Tabela,
  id: string,
  dados: { nome?: string; tema?: string; celebracao?: boolean },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  conferirTabela(tabela);

  const nome = dados.nome?.trim();
  if (nome !== undefined && nome.length < 2) {
    return { ok: false, erro: 'Informe o nome.' };
  }
  if (dados.tema !== undefined && !TEMAS.includes(dados.tema as Tema)) {
    return { ok: false, erro: 'Tema inválido.' };
  }

  await sql`
    update ${sql(tabela)} set
      nome       = coalesce(${nome ?? null}, nome),
      tema       = coalesce(${dados.tema ?? null}, tema),
      celebracao = coalesce(${dados.celebracao ?? null}, celebracao)
    where id = ${id}`;
  return { ok: true };
}

export async function salvarFoto(
  tabela: Tabela,
  id: string,
  arquivo: string | null,
): Promise<void> {
  conferirTabela(tabela);
  await sql`update ${sql(tabela)} set foto = ${arquivo} where id = ${id}`;
}

/**
 * Troca de senha.
 *
 * A senha atual é conferida no BANCO, na mesma consulta do update. Sem
 * isso, quem pegasse uma sessão aberta trocaria a senha sem conhecê-la —
 * e o dono legítimo perderia a conta.
 */
export async function trocarSenha(
  tabela: Tabela,
  id: string,
  atual: string,
  nova: string,
  confirmacao: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  conferirTabela(tabela);

  if (nova !== confirmacao) {
    return { ok: false, erro: 'A nova senha e a confirmação não conferem.' };
  }
  const forca = avaliarSenha(nova);
  if (!forca.ok) return { ok: false, erro: forca.problemas.join(' ') };
  if (nova === atual) {
    return { ok: false, erro: 'A nova senha precisa ser diferente da atual.' };
  }

  const r = await sql`
    update ${sql(tabela)}
       set senha_hash = crypt(${nova}, gen_salt('bf'))
     where id = ${id}
       and senha_hash is not null
       and senha_hash = crypt(${atual}, senha_hash)`;

  if (r.count === 0) return { ok: false, erro: 'Senha atual incorreta.' };
  return { ok: true };
}
