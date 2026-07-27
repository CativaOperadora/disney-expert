import { sql } from './db';

/**
 * Administração da plataforma (nível Cativa / super-admin).
 *
 * O super-admin é a equipe interna autenticada no CRM (sessão do painel).
 * Aqui ela cadastra novas Agências (organizações) e o respectivo
 * Administrador. Cada agência é isolada; o admin criado gerencia apenas os
 * agentes da própria organização (RBAC de 3 níveis: super-admin → admin da
 * agência → agente).
 */

const EMAIL_OK = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

export interface AgenciaResumo {
  id: string;
  nome: string;
  tier: string;
  ativa: boolean;
  total_agentes: number;
  solicitacoes: number;
  admin_nome: string | null;
  admin_email: string | null;
  criado_em: string;
}

export async function listarAgencias(): Promise<AgenciaResumo[]> {
  return sql<AgenciaResumo[]>`
    select
      ag.id, ag.nome, ag.tier, ag.ativa, ag.criado_em,
      (select count(*)::int from agentes a where a.agencia_id = ag.id) as total_agentes,
      (select count(*)::int from solicitacoes s where s.agencia_id = ag.id) as solicitacoes,
      (select a.nome  from agentes a where a.agencia_id = ag.id and a.admin order by a.criado_em limit 1) as admin_nome,
      (select a.email from agentes a where a.agencia_id = ag.id and a.admin order by a.criado_em limit 1) as admin_email
    from agencias ag
    order by ag.nome
  `;
}

export interface DadosNovaAgencia {
  nomeAgencia: string;
  tier: 'padrao' | 'select';
  nomeAdmin: string;
  emailAdmin: string;
  senha: string;
}

export async function criarAgencia(
  d: DadosNovaAgencia,
): Promise<{ ok: true; agenciaId: string; codigo: string } | { ok: false; erro: string }> {
  const nomeAgencia = String(d.nomeAgencia ?? '').trim();
  const nomeAdmin = String(d.nomeAdmin ?? '').trim();
  const emailAdmin = String(d.emailAdmin ?? '').trim();
  const senha = String(d.senha ?? '');
  const tier = d.tier === 'select' ? 'select' : 'padrao';

  if (nomeAgencia.length < 2) return { ok: false, erro: 'Informe o nome da agência.' };
  if (nomeAdmin.length < 2) return { ok: false, erro: 'Informe o nome do administrador.' };
  if (!EMAIL_OK(emailAdmin)) return { ok: false, erro: 'E-mail do administrador inválido.' };
  if (senha.length < 6) return { ok: false, erro: 'A senha deve ter ao menos 6 caracteres.' };

  const [ja] = await sql<{ id: string }[]>`
    select id from agentes where email = ${emailAdmin} and ativo limit 1`;
  if (ja) return { ok: false, erro: 'Já existe um usuário ativo com este e-mail.' };

  const slaHoras = tier === 'select' ? 24 : 48;

  try {
    const res = await sql.begin(async (tx) => {
      const [ag] = await tx<{ id: string }[]>`
        insert into agencias (nome, tier, sla_horas)
        values (${nomeAgencia}, ${tier}::tier_agencia, ${slaHoras})
        returning id`;
      const [novo] = await tx<{ codigo: string }[]>`
        insert into agentes (agencia_id, codigo, nome, email, admin, senha_hash)
        values (
          ${ag.id},
          'AG' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
          ${nomeAdmin}, ${emailAdmin}, true, crypt(${senha}, gen_salt('bf'))
        )
        returning codigo`;
      return { agenciaId: ag.id, codigo: novo.codigo };
    });
    return { ok: true, ...res };
  } catch (e) {
    console.error('[superadmin] criarAgencia', e);
    return { ok: false, erro: 'Não foi possível criar a agência. Tente de novo.' };
  }
}

export async function ativarAgencia(id: string, ativa: boolean): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const r = await sql`update agencias set ativa = ${ativa} where id = ${id}`;
  return r.count > 0;
}
