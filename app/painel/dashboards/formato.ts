/**
 * Formatadores e paleta compartilhados entre as páginas (server) e os
 * gráficos interativos (client). Sem 'use client' de propósito: pode ser
 * importado e chamado dos dois lados.
 *
 * Paleta validada (dataviz skill): categórica em ordem fixa; magnitude em
 * azul da marca; verde/vermelho reservados para estado.
 */

export const CATEGORICA = ['#2f6fd0', '#0ba7da', '#12a36b', '#e0812f', '#8a5cc7'];
export const AZUL = '#084987';
export const AZUL_CLARO = '#2f6fd0';
export const VERDE = '#12a36b';
export const VERMELHO = '#b3261e';
export const CINZA = '#cbd2d9';

export const COR_STATUS: Record<string, string> = {
  nova_solicitacao: '#0ba7da',
  consultoria_realizada: '#2f6fd0',
  venda_finalizada: '#12a36b',
  venda_perdida: '#b3261e',
  concluida: '#6b7a89',
  duplicada: '#9aa4ae',
};

export const fmtInt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function fmtReais(n: number): string {
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  const milhar = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}R$ ${milhar},${d}`;
}

export function fmtReaisCurto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace('.', ',')} mil`;
  return fmtReais(n);
}

export const fmtPct = (x: number, dec = 1) =>
  `${(x * 100).toFixed(dec).replace('.', ',')}%`;

export function fmtDuracao(seg: number | null): string {
  if (seg == null) return '—';
  const h = seg / 3600;
  if (h < 1) return `${Math.max(1, Math.round(seg / 60))} min`;
  if (h < 48) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  const rh = Math.round(h - d * 24);
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtBucket(bucket: string, gran: string): string {
  const [a, m, d] = bucket.split('-');
  if (gran === 'ano') return a;
  if (gran === 'mes') return `${MESES_CURTO[Number(m) - 1]}/${a.slice(2)}`;
  return `${d}/${m}`;
}

/** Escolhe o formatador a partir de um nome (props serializáveis server→client). */
export type Formato = 'int' | 'reais' | 'reaisCurto' | 'pct';
export function formatarPor(f: Formato | undefined, n: number): string {
  switch (f) {
    case 'reais': return fmtReais(n);
    case 'reaisCurto': return fmtReaisCurto(n);
    case 'pct': return fmtPct(n);
    default: return fmtInt(n);
  }
}
