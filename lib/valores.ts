/**
 * Conversão e formatação de valores em reais.
 *
 * Fonte única para o CRM interno e para o Portal do Agente: os dois gravam
 * na mesma coluna `solicitacoes.valor_total_venda`, então precisam
 * interpretar o que o usuário digita exatamente da mesma forma. Qualquer
 * divergência aqui viraria diferença de faturamento entre os dashboards.
 */

/** Converte "R$ 12.500,00", "12500", "12.500,00" ou número em reais. */
export function paraReais(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d,.-]/g, '').trim();
  if (!s) return null;
  // Formato brasileiro: ponto de milhar e vírgula decimal.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Formata um número no padrão brasileiro (12500 → "12.500,00"), sem locale. */
export function formatarBRL(n: number): string {
  const [inteiro, dec] = n.toFixed(2).split('.');
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${milhar},${dec}`;
}
