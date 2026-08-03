/**
 * Geração de CSV para abrir no Excel brasileiro.
 *
 * Duas decisões que parecem detalhe e não são:
 *
 * 1. SEPARADOR ';' — o Excel em português usa a vírgula como separador
 *    decimal, então um CSV separado por vírgula abre com tudo em uma
 *    coluna só. Ponto e vírgula é o que funciona sem o usuário precisar
 *    passar pelo assistente de importação.
 *
 * 2. BOM UTF-8 — sem ele o Excel assume a codificação do sistema e todo
 *    acento vira caractere quebrado ("São" -> "SÃ£o").
 *
 * Os caracteres invisíveis (BOM, diacríticos combinantes) são escritos
 * como escape \u de propósito: em literal eles somem numa cópia e colagem
 * distraída e o defeito só aparece na planilha do usuário.
 */

/**
 * Neutraliza injeção de fórmula.
 *
 * Os dados vêm de um formulário PÚBLICO. Uma célula começando com '=',
 * '+', '-', '@' ou tab é interpretada como fórmula pelo Excel e pelo
 * Google Sheets — e uma fórmula pode disparar chamada externa ou vazar o
 * conteúdo da planilha. Prefixar com aspa simples faz a célula ser tratada
 * como texto, que é o que ela sempre deveria ter sido.
 */
function neutralizar(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = neutralizar(String(valor));
  // Aspas duplas dobradas; envolve sempre que houver separador, aspa ou quebra.
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const BOM = '﻿';

export function gerarCsv(cabecalhos: string[], linhas: unknown[][]): string {
  const corpo = [cabecalhos, ...linhas]
    .map((linha) => linha.map(celula).join(';'))
    .join('\r\n');
  return BOM + corpo;
}

/** Nome de arquivo seguro, sem acento nem caractere que quebre o header. */
export function nomeArquivo(base: string, extensao = 'csv'): string {
  const limpo = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos separados pelo NFD
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${limpo || 'exportacao'}.${extensao}`;
}
