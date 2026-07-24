'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Filtros as TFiltros, OpcoesFiltro } from '@/lib/bi';

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function Filtros({
  opcoes,
  filtros,
}: {
  opcoes: OpcoesFiltro;
  filtros: TFiltros;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function aplicar(patch: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') p.delete(k);
      else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function ultimosDias(dias: number) {
    const ate = new Date();
    const de = new Date();
    de.setDate(de.getDate() - dias + 1);
    aplicar({ de: iso(de), ate: iso(ate) });
  }

  function esteAno() {
    const hoje = new Date();
    aplicar({ de: `${hoje.getFullYear()}-01-01`, ate: iso(hoje) });
  }

  const algumFiltro =
    filtros.de ||
    filtros.ate ||
    filtros.agencia ||
    filtros.agente ||
    filtros.consultora ||
    filtros.status ||
    filtros.cidade ||
    filtros.parque;

  return (
    <div className="filtros">
      <div className="filtros-atalhos">
        <button className="chip" onClick={() => ultimosDias(30)}>Últimos 30 dias</button>
        <button className="chip" onClick={() => ultimosDias(90)}>Últimos 90 dias</button>
        <button className="chip" onClick={esteAno}>Este ano</button>
        {algumFiltro && (
          <button className="chip chip-limpar" onClick={() => router.push(pathname)}>
            Limpar filtros
          </button>
        )}
      </div>

      <div className="filtros-grade">
        <label className="filtro">
          <span>De</span>
          <input
            type="date"
            className="entrada"
            value={filtros.de ?? ''}
            onChange={(e) => aplicar({ de: e.target.value })}
          />
        </label>
        <label className="filtro">
          <span>Até</span>
          <input
            type="date"
            className="entrada"
            value={filtros.ate ?? ''}
            onChange={(e) => aplicar({ ate: e.target.value })}
          />
        </label>
        <label className="filtro">
          <span>Agrupar por</span>
          <select
            className="entrada"
            value={filtros.granularidade}
            onChange={(e) => aplicar({ gran: e.target.value })}
          >
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
          </select>
        </label>

        <label className="filtro">
          <span>Agência</span>
          <select className="entrada" value={filtros.agencia ?? ''} onChange={(e) => aplicar({ agencia: e.target.value })}>
            <option value="">Todas</option>
            {opcoes.agencias.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="filtro">
          <span>Agente</span>
          <select className="entrada" value={filtros.agente ?? ''} onChange={(e) => aplicar({ agente: e.target.value })}>
            <option value="">Todos</option>
            {opcoes.agentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="filtro">
          <span>Consultora</span>
          <select className="entrada" value={filtros.consultora ?? ''} onChange={(e) => aplicar({ consultora: e.target.value })}>
            <option value="">Todas</option>
            {opcoes.consultoras.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="filtro">
          <span>Situação</span>
          <select className="entrada" value={filtros.status ?? ''} onChange={(e) => aplicar({ status: e.target.value })}>
            <option value="">Todas</option>
            {opcoes.status.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
          </select>
        </label>
        <label className="filtro">
          <span>Cidade de origem</span>
          <select className="entrada" value={filtros.cidade ?? ''} onChange={(e) => aplicar({ cidade: e.target.value })}>
            <option value="">Todas</option>
            {opcoes.cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="filtro">
          <span>Parque</span>
          <select className="entrada" value={filtros.parque ?? ''} onChange={(e) => aplicar({ parque: e.target.value })}>
            <option value="">Todos</option>
            {opcoes.parques.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
