import { identidadeAtual } from './sessao-atual';
import { lerPreferencias } from './preferencias';

/**
 * Tema do usuário logado, para o layout raiz.
 *
 * Roda em TODA página, inclusive as públicas (o formulário do cliente),
 * onde não há sessão. Por isso engole qualquer erro e devolve 'sistema':
 * uma falha de banco não pode derrubar a página que o cliente final vê.
 */
export async function temaDoUsuario(): Promise<string> {
  try {
    const eu = await identidadeAtual();
    if (!eu) return 'sistema';
    const p = await lerPreferencias(eu.tabela, eu.id);
    return p?.tema ?? 'sistema';
  } catch {
    return 'sistema';
  }
}
