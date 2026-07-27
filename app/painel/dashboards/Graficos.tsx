'use client';

/**
 * Gráficos interativos do BI (estilo Power BI / Looker).
 *
 * Todos são client components: tooltip rico no hover, destaque do elemento
 * apontado (os demais esmaecem), animação de entrada e transição suave
 * quando os filtros mudam. Os dados chegam já agregados do servidor (props
 * serializáveis); os formatadores vêm de ./formato (módulo compartilhado).
 */

import { useState, useEffect, useRef } from 'react';
import {
  CATEGORICA, AZUL, AZUL_CLARO, VERDE, COR_STATUS,
  fmtInt, fmtReais, fmtReaisCurto, fmtPct, fmtBucket, formatarPor, type Formato,
} from './formato';

// tooltip flutuante posicionado pelo cursor, relativo ao container
function Dica({ d }: { d: { x: number; y: number; nodes: React.ReactNode } | null }) {
  if (!d) return null;
  return (
    <div className="graf-dica" style={{ left: d.x, top: d.y }}>
      {d.nodes}
    </div>
  );
}
function posRel(e: React.MouseEvent, sel = '.graf-interativo') {
  const box = (e.currentTarget.closest(sel) as HTMLElement)?.getBoundingClientRect();
  if (!box) return { x: 0, y: 0 };
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}
function useMontado(delay = 40) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setM(true), delay);
    return () => clearTimeout(t);
  }, []);
  return m;
}

// ------------------------------------------------------------------ KPI card

export function KpiCard({
  titulo, valor, delta, destaque, invertido,
}: {
  titulo: string; valor: string; delta?: number | null; destaque?: boolean; invertido?: boolean;
}) {
  let cls = 'kpi-delta';
  let seta = '';
  if (delta != null && Number.isFinite(delta) && Math.abs(delta) >= 0.0005) {
    const bom = invertido ? delta < 0 : delta > 0;
    cls += bom ? ' sobe' : ' desce';
    seta = delta > 0 ? '▲' : '▼';
  }
  return (
    <div className={`kpi kpi-anima ${destaque ? 'kpi-destaque' : ''}`}>
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
  itens, cor = AZUL, formato,
}: {
  itens: { rotulo: string; n: number }[]; cor?: string; formato?: Formato;
}) {
  const montado = useMontado();
  const [hover, setHover] = useState<number | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; nodes: React.ReactNode } | null>(null);
  if (itens.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;
  const max = Math.max(...itens.map((i) => i.n), 1);

  return (
    <div
      className="barras graf-interativo"
      onMouseLeave={() => { setHover(null); setDica(null); }}
    >
      {itens.map((it, i) => (
        <div
          className={`barra-linha ${hover !== null && hover !== i ? 'esmaece' : ''}`}
          key={it.rotulo + i}
          onMouseEnter={() => setHover(i)}
          onMouseMove={(e) => {
            const p = posRel(e);
            setDica({ x: p.x, y: p.y, nodes: (
              <><strong>{it.rotulo}</strong><br />{formatarPor(formato, it.n)}</>
            ) });
          }}
        >
          <span className="barra-rotulo" title={it.rotulo}>{it.rotulo}</span>
          <div className="barra-trilho">
            <div
              className="barra-preenchida anima-largura"
              style={{ width: montado ? `${(it.n / max) * 100}%` : '0%', background: cor }}
            />
          </div>
          <span className="barra-valor">{formatarPor(formato, it.n)}</span>
        </div>
      ))}
      <Dica d={dica} />
    </div>
  );
}

// ------------------------------------------------------------------- rosca (donut)

export function Rosca({
  fatias, cores, formato,
}: {
  fatias: { rotulo: string; n: number; chave?: string }[]; cores?: string[]; formato?: Formato;
}) {
  const montado = useMontado();
  const [hover, setHover] = useState<number | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; nodes: React.ReactNode } | null>(null);
  const total = fatias.reduce((s, f) => s + f.n, 0);
  if (total === 0) return <p className="vazio-grafico">Sem dados no período.</p>;

  const R = 70, r = 44, cx = 90, cy = 90;
  let acc = 0;
  const arcos = fatias.map((f, i) => {
    const frac = f.n / total;
    const a0 = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const a1 = acc * 2 * Math.PI - Math.PI / 2;
    const grande = frac > 0.5 ? 1 : 0;
    const cor = f.chave ? COR_STATUS[f.chave] ?? CATEGORICA[i % 5] : (cores ?? CATEGORICA)[i % 5];
    const p = (rad: number, ang: number) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)];
    const [x0, y0] = p(R, a0), [x1, y1] = p(R, a1), [xi1, yi1] = p(r, a1), [xi0, yi0] = p(r, a0);
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${grande} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${grande} 0 ${xi0} ${yi0} Z`;
    return { d, cor, f, frac };
  });

  return (
    <div className="rosca-wrap graf-interativo" onMouseLeave={() => { setHover(null); setDica(null); }}>
      <svg viewBox="0 0 180 180" className={`rosca-svg ${montado ? 'aparece' : 'invisivel'}`} role="img">
        {arcos.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill={a.cor}
            stroke="#fff"
            strokeWidth="2"
            className={`rosca-arco ${hover !== null && hover !== i ? 'esmaece' : ''} ${hover === i ? 'destaque' : ''}`}
            onMouseEnter={() => setHover(i)}
            onMouseMove={(e) => {
              const p = posRel(e);
              setDica({ x: p.x, y: p.y, nodes: (
                <><strong>{a.f.rotulo}</strong><br />{formatarPor(formato, a.f.n)} · {fmtPct(a.frac)}</>
              ) });
            }}
          />
        ))}
        <text x="90" y="86" textAnchor="middle" className="rosca-total">
          {hover !== null ? fmtInt(arcos[hover].f.n) : fmtInt(total)}
        </text>
        <text x="90" y="102" textAnchor="middle" className="rosca-total-rot">
          {hover !== null ? arcos[hover].f.rotulo : 'total'}
        </text>
      </svg>
      <ul className="legenda">
        {arcos.map((a, i) => (
          <li
            key={i}
            className={hover !== null && hover !== i ? 'esmaece' : ''}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="legenda-cor" style={{ background: a.cor }} />
            <span className="legenda-rot">{a.f.rotulo}</span>
            <span className="legenda-num">{formatarPor(formato, a.f.n)} · {fmtPct(a.frac, 0)}</span>
          </li>
        ))}
      </ul>
      <Dica d={dica} />
    </div>
  );
}

// ------------------------------------------------------------------ linha (evolução)

export function LinhaEvolucao({
  pontos, gran,
}: {
  pontos: { bucket: string; solicitacoes: number; vendas: number }[]; gran: string;
}) {
  const montado = useMontado();
  const [hi, setHi] = useState<number | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; nodes: React.ReactNode } | null>(null);
  if (pontos.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;

  const W = 720, H = 240, ml = 34, mr = 12, mt = 14, mb = 28;
  const iw = W - ml - mr, ih = H - mt - mb;
  const max = Math.max(...pontos.map((p) => Math.max(p.solicitacoes, p.vendas)), 1);
  const n = pontos.length;
  const x = (i: number) => ml + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => mt + ih - (v / max) * ih;
  const serie = (sel: (p: any) => number) => pontos.map((p, i) => `${x(i)},${y(sel(p))}`).join(' ');
  const linhaSol = serie((p) => p.solicitacoes);
  const linhaVen = serie((p) => p.vendas);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const rotulosX = n <= 8 ? pontos.map((_, i) => i) : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];

  return (
    <div className="graf-interativo">
      <div className="legenda-linha">
        <span><span className="legenda-cor" style={{ background: AZUL_CLARO }} /> Solicitações</span>
        <span><span className="legenda-cor" style={{ background: VERDE }} /> Vendas</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="grafico-svg"
        role="img"
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - box.left) / box.width) * W;
          let i = n === 1 ? 0 : Math.round(((mx - ml) / iw) * (n - 1));
          i = Math.max(0, Math.min(n - 1, i));
          setHi(i);
          const p = posRel(e);
          setDica({ x: p.x, y: p.y, nodes: (
            <><strong>{fmtBucket(pontos[i].bucket, gran)}</strong><br />
              {pontos[i].solicitacoes} solicitações<br />{pontos[i].vendas} vendas</>
          ) });
        }}
        onMouseLeave={() => { setHi(null); setDica(null); }}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eceef0" strokeWidth="1" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" className="eixo-num">{fmtInt(t)}</text>
          </g>
        ))}
        {hi !== null && (
          <line x1={x(hi)} x2={x(hi)} y1={mt} y2={mt + ih} stroke="#c9d2db" strokeWidth="1" strokeDasharray="3 3" />
        )}
        <polyline points={linhaSol} fill="none" stroke={AZUL_CLARO} strokeWidth="2" strokeLinejoin="round"
          className={`linha-anima ${montado ? 'desenhada' : ''}`} />
        <polyline points={linhaVen} fill="none" stroke={VERDE} strokeWidth="2" strokeLinejoin="round"
          className={`linha-anima ${montado ? 'desenhada' : ''}`} />
        {pontos.map((p, i) => (
          <g key={i} opacity={hi === null || hi === i ? 1 : 0.35} style={{ transition: 'opacity .15s' }}>
            <circle cx={x(i)} cy={y(p.solicitacoes)} r={hi === i ? 5 : 3.5} fill={AZUL_CLARO} style={{ transition: 'r .1s' }} />
            <circle cx={x(i)} cy={y(p.vendas)} r={hi === i ? 5 : 3.5} fill={VERDE} style={{ transition: 'r .1s' }} />
          </g>
        ))}
        {rotulosX.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="eixo-num">
            {fmtBucket(pontos[i].bucket, gran)}
          </text>
        ))}
      </svg>
      <Dica d={dica} />
    </div>
  );
}

// ------------------------------------------------------- barras verticais (faturamento)

export function BarrasFaturamento({
  pontos, gran,
}: {
  pontos: { bucket: string; faturamento: number }[]; gran: string;
}) {
  const montado = useMontado();
  const [hover, setHover] = useState<number | null>(null);
  const [dica, setDica] = useState<{ x: number; y: number; nodes: React.ReactNode } | null>(null);
  const comValor = pontos.filter((p) => p.faturamento > 0);
  if (comValor.length === 0) return <p className="vazio-grafico">Sem faturamento no período.</p>;

  const W = 720, H = 220, ml = 48, mr = 12, mt = 14, mb = 28;
  const iw = W - ml - mr, ih = H - mt - mb;
  const max = Math.max(...pontos.map((p) => p.faturamento), 1);
  const n = pontos.length;
  const bw = Math.min(46, (iw / n) * 0.6);
  const step = iw / n;
  const y = (v: number) => mt + ih - (v / max) * ih;
  const ticks = [0, 0.5, 1].map((t) => max * t);

  return (
    <div className="graf-interativo" onMouseLeave={() => { setHover(null); setDica(null); }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="grafico-svg" role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke="#eceef0" strokeWidth="1" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" className="eixo-num">{fmtReaisCurto(t)}</text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const cxb = ml + step * i + step / 2;
          const alturaFinal = ih - (y(p.faturamento) - mt);
          const altura = montado ? Math.max(0, alturaFinal) : 0;
          return (
            <g key={i} opacity={hover === null || hover === i ? 1 : 0.4} style={{ transition: 'opacity .15s' }}>
              <rect
                x={cxb - bw / 2} y={mt + ih - altura} width={bw} height={altura} rx="3" fill={AZUL}
                className="barra-vert"
                onMouseEnter={() => setHover(i)}
                onMouseMove={(e) => {
                  const pr = posRel(e);
                  setDica({ x: pr.x, y: pr.y, nodes: (
                    <><strong>{fmtBucket(p.bucket, gran)}</strong><br />{fmtReais(p.faturamento)}</>
                  ) });
                }}
              />
              {n <= 12 && (
                <text x={cxb} y={H - 8} textAnchor="middle" className="eixo-num">{fmtBucket(p.bucket, gran)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <Dica d={dica} />
    </div>
  );
}

// ------------------------------------------------------------------ tabela de ranking

export function TabelaRanking({
  itens, colValor, formatoValor = 'reais', rotuloN = 'Qtd.',
}: {
  itens: { rotulo: string; sub?: string; n: number; valor?: number }[];
  colValor?: string; formatoValor?: Formato; rotuloN?: string;
}) {
  if (itens.length === 0) return <p className="vazio-grafico">Sem dados no período.</p>;
  return (
    <table className="rank-tabela rank-interativa">
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
            {colValor && <td className="rank-num">{formatarPor(formatoValor, it.valor ?? 0)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
