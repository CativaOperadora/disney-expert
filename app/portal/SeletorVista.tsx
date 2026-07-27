'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function SeletorVista({ vista }: { vista: 'lista' | 'kanban' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function ir(v: 'lista' | 'kanban') {
    const p = new URLSearchParams(sp.toString());
    if (v === 'lista') p.delete('vista');
    else p.set('vista', v);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="seletor-vista" role="tablist" aria-label="Forma de visualização">
      <button
        role="tab"
        aria-selected={vista === 'lista'}
        className={`sv-btn ${vista === 'lista' ? 'ativo' : ''}`}
        onClick={() => ir('lista')}
      >
        Lista
      </button>
      <button
        role="tab"
        aria-selected={vista === 'kanban'}
        className={`sv-btn ${vista === 'kanban' ? 'ativo' : ''}`}
        onClick={() => ir('kanban')}
      >
        Kanban
      </button>
    </div>
  );
}
