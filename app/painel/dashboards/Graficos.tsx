/**
 * Componentes visuais do dashboard — SVG puro, sem dependências.
 *
 * Paleta validada (dataviz): categórica em ordem fixa, magnitude em azul da
 * marca, verde/vermelho reservados para estado (venda ganha/perdida). Texto
 * sempre em tinta neutra; a cor fica na marca, nunca no rótulo.
 */

export const CATEGORICA = ['#2f6fd0', '#0ba7da', '#12a36b', '#e0812f', '#8a5cc7'];
export const AZUL = '#084987';
export const AZUL_CLARO = '#2f6fd0';
export const VERDE = '#12a36b';
export const VERMELHO = '#b3261e';
export const CINZA = '#cbd2d9';

const COR_STATUS: Record<string, string> = {
  nova_solicitacao: '#0ba7da',
  consultoria_realizada: '#2f6fd0',
  venda_finalizada: '#12a36b',
  venda_perdida: '#b3261e',
  duplicada: '#9aa4ae',
};

// --------------------------------------------------------------- formatação

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

// ------------------------------------------------------------------ KPI card

export function KpiCard({
  titulo,
  valor,
  delta,
  destaque,
  invertido,
}: {
  titulo: string;
  valor: string;
  delta?: number | null;
  destaque?: boolean;
  invertido?: boolean; // quando cair é bom (ex.: tempos)
}) {
  let cls = 'kpi-delta';
  let seta = '';
  if (delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.0005) {
    const bom = invertido ? delta < 0 : delta > 0;
    cls += bom ? ' sobe' : ' desce';
    seta = delta > 0 ? '▲' : '▼';
  }
  return (
    <div className={`kpi ${destaque ? 'kpi-destaque' : ''}`}>
      <span className="kpi-titulo">{titulo}</span>
      <span className="kpi-valor">{valor}</span>
      {delta != null && Number.isFinite(delta) && (
        <span className={cls}>
          {seta} {fmtPct(Math.abs(delta), 1)} <span className="kpi-vs">vs. período anterior</span>
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------- barras horizontais

export function BarrasH({
  itens,
  cor = AZUL,
  formatar = fmtInt,
}: {
  itens: { rotulo: string; n: number }[];
  cor?: string;
  formatar?: (n: number) => string;
}) {
  if (itens.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;
  const max = Math.max(...itens.map((i) => i.n), 1);
  return (
    <div className="barras">
      {itens.map((it) => (
        <div className="barra-linha" key={it.rotulo} title={`${it.rotulo}: ${formatar(it.n)}`}>
          <span className="barra-rotulo" title={it.rotulo}>{it.rotulo}</span>
          <div className="barra-trilho">
            <div
              className="barra-preenchida"
              style={{ width: `${(it.n / max) * 100}%`, background: cor }}
            />
          </div>
          <span className="barra-valor">{formatar(it.n)}</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------- rosca (donut)

export function Rosca({
  fatias,
  cores,
  formatar = fmtInt,
}: {
  fatias: { rotulo: string; n: number; chave?: string }[];
  cores?: string[];
  formatar?: (n: number) => string;
}) {
  const total = fatias.reduce((s, f) => s + f.n, 0);
  if (total === 0) return <p className="vazio-grafico">Sem dados no período.</p>;

  const R = 70;
  const r = 44;
  const cx = 90;
  const cy = 90;
  let acc = 0;
  const arcos = fatias.map((f, i) => {
    const frac = f.n / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const grande = frac > 0.5 ? 1 : 0;
    const cor = f.chave ? COR_STATUS[f.chave] ?? CATEGORICA[i % 5] : (cores ?? CATEGORICA)[i % 5];
    const x0 = cx + R * Math.cos(a0);
    const y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1);
    const y1 = cy + R * Math.sin(a1);
    const xi1 = cx + r * Math.cos(a1);
    const yi1 = cy + r * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0);
    const yi0 = cy + r * Math.sin(a0);
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${grande} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${grande} 0 ${xi0} ${yi0} Z`;
    return { d, cor, f, frac };
  });

  return (
    <div className="rosca-wrap">
      <svg viewBox="0 0 180 180" className="rosca-svg" role="img">
        {arcos.map((a, i) => (
          <path key={i} d={a.d} fill={a.cor} stroke="#fff" strokeWidth="2">
            <title>{`${a.f.rotulo}: ${formatar(a.f.n)} (${fmtPct(a.frac)})`}</title>
          </path>
        ))}
        <text x="90" y="86" textAnchor="middle" className="rosca-total">{fmtInt(total)}</text>
        <text x="90" y="102" textAnchor="middle" className="rosca-total-rot">total</text>
      </svg>
      <ul className="legenda">
        {arcos.map((a, i) => (
          <li key={i}>
            <span className="legenda-cor" style={{ background: a.cor }} />
            <span className="legenda-rot">{a.f.rotulo}</span>
            <span className="legenda-num">{formatar(a.f.n)} · {fmtPct(a.frac, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ linha (evolução)

export function LinhaEvolucao({
  pontos,
  gran,
}: {
  pontos: { bucket: string; solicitacoes: number; vendas: number }[];
  gran: string;
}) {
  if (pontos.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;

  const W = 720;
  const H = 240;
  const ml = 34;
  const mr = 12;
  const mt = 14;
  const mb = 28;
  const iw = W - ml - mr;
  const ih = H - mt - mb;
  const max = Math.max(...pontos.map((p) => Math.max(p.solicitacoes, p.vendas)), 1);
  const n = pontos.length;
  const x = (i: number) => ml + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => mt + ih - (v / max) * ih;

  const serie = (sel: (p: any) => number) =>
    pontos.map((p, i) => `${x(i)},${y(sel(p))}`).join(' ');

  const linhaSol = serie((p) => p.solicitacoes);
  const linhaVen = serie((p) => p.vendas);

  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const rotulosX =
    n <= 8 ? pontos.map((_, i) => i) : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <div>
      <div className="legenda-linha">
        <span><span className="legenda-cor" style={{ background: AZUL_CLARO }} /> Solicitações</span>
        <span><span className="legenda-cor" style={{ background: VERDE }} /> Vendas</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eceef0" strokeWidth="1" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" className="eixo-num">{fmtInt(t)}</text>
          </g>
        ))}
        <polyline points={linhaSol} fill="none" stroke={AZUL_CLARO} strokeWidth="2" strokeLinejoin="round" />
        <polyline points={linhaVen} fill="none" stroke={VERDE} strokeWidth="2" strokeLinejoin="round" />
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.solicitacoes)} r="3.5" fill={AZUL_CLARO}>
              <title>{`${fmtBucket(p.bucket, gran)} · ${p.solicitacoes} solicitações`}</title>
            </circle>
            <circle cx={x(i)} cy={y(p.vendas)} r="3.5" fill={VERDE}>
              <title>{`${fmtBucket(p.bucket, gran)} · ${p.vendas} vendas`}</title>
            </circle>
          </g>
        ))}
        {rotulosX.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="eixo-num">
            {fmtBucket(pontos[i].bucket, gran)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ------------------------------------------------------- barras verticais (faturamento)

export function BarrasFaturamento({
  pontos,
  gran,
}: {
  pontos: { bucket: string; faturamento: number }[];
  gran: string;
}) {
  const comValor = pontos.filter((p) => p.faturamento > 0);
  if (comValor.length === 0) return <p className="vazio-grafico">Sem faturamento no período.</p>;

  const W = 720;
  const H = 220;
  const ml = 48;
  const mr = 12;
  const mt = 14;
  const mb = 28;
  const iw = W - ml - mr;
  const ih = H - mt - mb;
  const max = Math.max(...pontos.map((p) => p.faturamento), 1);
  const n = pontos.length;
  const bw = Math.min(46, (iw / n) * 0.6);
  const step = iw / n;
  const y = (v: number) => mt + ih - (v / max) * ih;
  const ticks = [0, 0.5, 1].map((t) => max * t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eceef0" strokeWidth="1" />
          <text x={ml - 6} y={y(t) + 4} textAnchor="end" className="eixo-num">{fmtReaisCurto(t)}</text>
        </g>
      ))}
      {pontos.map((p, i) => {
        const cx = ml + step * i + step / 2;
        const altura = ih - (y(p.faturamento) - mt);
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={y(p.faturamento)}
              width={bw}
              height={Math.max(0, altura)}
              rx="3"
              fill={AZUL}
            >
              <title>{`${fmtBucket(p.bucket, gran)}: ${fmtReais(p.faturamento)}`}</title>
            </rect>
            {(n <= 12) && (
              <text x={cx} y={H - 8} textAnchor="middle" className="eixo-num">
                {fmtBucket(p.bucket, gran)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ tabela de ranking

export function TabelaRanking({
  itens,
  colValor,
  formatarValor = fmtReais,
  rotuloN = 'Qtd.',
}: {
  itens: { rotulo: string; sub?: string; n: number; valor?: number }[];
  colValor?: string;
  formatarValor?: (n: number) => string;
  rotuloN?: string;
}) {
  if (itens.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;
  return (
    <table className="rank-tabela">
      <thead>
        <tr>
          <th className="rank-pos">#</th>
          <th>Nome</th>
          <th className="rank-num">{rotuloN}</th>
          {colValor && <th className="rank-num">{colValor}</th>}
        </tr>
      </thead>
      <tbody>
        {itens.map((it, i) => (
          <tr key={it.rotulo + i}>
            <td className="rank-pos">{i + 1}</td>
            <td>
              <span className="rank-nome">{it.rotulo}</span>
              {it.sub && <span className="rank-sub">{it.sub}</span>}
            </td>
            <td className="rank-num">{fmtInt(it.n)}</td>
            {colValor && <td className="rank-num">{formatarValor(it.valor ?? 0)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
