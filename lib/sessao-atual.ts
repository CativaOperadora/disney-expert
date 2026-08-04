import { sessaoPainel } from './auth';
import { sessaoPortal } from './portal-auth';
import type { Tabela } from './preferencias';

/**
 * Quem está logado, seja no CRM interno ou no Portal.
 *
 * Preferências valem para os dois públicos, mas eles vivem em tabelas
 * diferentes. Este módulo resolve isso num lugar só, para as telas e
 * rotas de preferência não precisarem saber de qual lado vieram.
 *
 * Sessão de emergência (senha compartilhada) devolve null: não há
 * usuário a quem associar preferência.
 */
export interface Identidade {
  tabela: Tabela;
  id: string;
  nome: string;
  /** 'painel' = equipe Cativa; 'portal' = agências. */
  area: 'painel' | 'portal';
}

export async function identidadeAtual(): Promise<Identidade | null> {
  const interna = await sessaoPainel();
  if (interna?.usuarioId) {
    return {
      tabela: 'usuarios',
      id: interna.usuarioId,
      nome: interna.nome,
      area: 'painel',
    };
  }

  const portal = await sessaoPortal();
  if (portal) {
    return {
      tabela: 'agentes',
      id: portal.agenteId,
      nome: portal.nome,
      area: 'portal',
    };
  }
  return null;
}
