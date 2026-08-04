/**
 * Regra de senha, única para os dois lados do sistema.
 *
 * Fica em módulo próprio, sem dependência de runtime, porque a mesma
 * regra precisa valer no navegador (feedback imediato enquanto digita) e
 * no servidor (a validação que realmente conta). Duplicar a regra em dois
 * lugares faria uma delas envelhecer sozinha.
 */

export const MIN_SENHA = 8;

/** Qualquer coisa que não seja letra, número ou espaço. */
const ESPECIAL = /[^A-Za-z0-9\s]/;

export interface ForcaSenha {
  ok: boolean;
  /** Falhas em texto, na ordem em que devem ser mostradas. */
  problemas: string[];
  temTamanho: boolean;
  temEspecial: boolean;
}

export function avaliarSenha(senha: string): ForcaSenha {
  const temTamanho = senha.length >= MIN_SENHA;
  const temEspecial = ESPECIAL.test(senha);
  const problemas: string[] = [];

  if (!temTamanho) problemas.push(`Use ao menos ${MIN_SENHA} caracteres.`);
  if (!temEspecial) {
    problemas.push('Inclua ao menos um caractere especial, como ! @ # $ % & *');
  }

  return { ok: problemas.length === 0, problemas, temTamanho, temEspecial };
}
