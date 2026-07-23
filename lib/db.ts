import postgres from 'postgres';

/**
 * Conexão única com o PostgreSQL.
 *
 * Em produção, DATABASE_URL é montada pelo docker-compose apontando para
 * o serviço `db` na rede interna do Docker. O banco não é acessível de
 * fora do servidor, por desenho.
 */

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Confira o arquivo .env.');
}

declare global {
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__sql ??
  postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    types: {
      // Devolve date como texto puro, sem conversão de fuso.
      date: { to: 1082, from: [1082], serialize: (x: any) => x, parse: (x: any) => x },
    },
  });

if (process.env.NODE_ENV !== 'production') global.__sql = sql;

export interface AgenteResolvido {
  agente_id: string;
  agente_nome: string;
  agente_email: string;
  agencia_id: string;
  agencia_nome: string;
}

/** Traduz o código do link para o agente e a agência. */
export async function resolverAgente(
  codigo: string,
): Promise<AgenteResolvido | null> {
  const linhas = await sql<AgenteResolvido[]>`
    select
      a.id    as agente_id,
      a.nome  as agente_nome,
      a.email as agente_email,
      ag.id   as agencia_id,
      ag.nome as agencia_nome
    from agentes a
    join agencias ag on ag.id = a.agencia_id
    where upper(a.codigo) = upper(${codigo})
      and a.ativo
      and ag.ativa
    limit 1
  `;
  return linhas[0] ?? null;
}
