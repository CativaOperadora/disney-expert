'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Sino do CRM interno.
 *
 * Gêmeo do `app/portal/Notificacoes.tsx`, com a rota e o destino do link
 * trocados (`/api/notificacoes` e `/painel/{id}`). Os dois não foram
 * unificados de propósito: o dia em que o interno precisar de agrupamento
 * por consultora, ou de uma ação direta no item, um componente único viraria
 * uma teia de condicionais para servir dois públicos com regras diferentes.
 * Aproveita o mesmo CSS (`.sino-*`), que já é global.
 *
 * ENTREGA — não há WebSocket nesta infraestrutura, então o sino consulta o
 * contador a cada 30s: uma agregação sobre índice parcial.
 *
 * TOAST — só quando o contador CRESCE em relação à última leitura. Sem essa
 * comparação, recarregar a página faria o aviso reaparecer.
 */

interface Item {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  solicitacao_id: string | null;
  lida_em: string | null;
  criado_em: string;
}

const QUANDO = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

function haQuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)}h`;
  return QUANDO.format(new Date(iso));
}

const ICONE: Record<string, string> = {
  solicitacao_nova_interna: '✦',
};

export default function Notificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Item[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const anterior = useRef<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);

  const buscarContador = useCallback(async () => {
    try {
      const r = await fetch('/api/notificacoes?contador=1');
      if (!r.ok) return;
      const d = await r.json();
      const n = Number(d?.naoLidas ?? 0);

      if (anterior.current !== null && n > anterior.current) {
        setToast(
          n - anterior.current === 1
            ? 'Chegou uma nova solicitação'
            : `Chegaram ${n - anterior.current} novas solicitações`,
        );
      }
      anterior.current = n;
      setNaoLidas(n);
    } catch {
      /* rede instável não deve poluir a tela */
    }
  }, []);

  useEffect(() => {
    buscarContador();
    const t = setInterval(buscarContador, 30_000);
    return () => clearInterval(t);
  }, [buscarContador]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  async function abrir() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    try {
      const r = await fetch('/api/notificacoes');
      if (!r.ok) return;
      const d = await r.json();
      setItens(d.itens ?? []);

      // Abrir é o gesto que marca como lido — é o que zera o contador.
      if ((d.naoLidas ?? 0) > 0) {
        await fetch('/api/notificacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        setNaoLidas(0);
        anterior.current = 0;
        router.refresh();
      }
    } catch {
      /* silencioso */
    }
  }

  return (
    <>
      <div className="sino-caixa" ref={caixa}>
        <button
          type="button"
          className={`sino${naoLidas > 0 ? ' com-aviso' : ''}`}
          onClick={abrir}
          aria-label={
            naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'
          }
          aria-expanded={aberto}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {naoLidas > 0 && (
            <span className="sino-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>
          )}
        </button>

        {aberto && (
          <div className="sino-painel" role="dialog" aria-label="Notificações">
            <header className="sino-painel-topo">
              <strong>Notificações</strong>
            </header>

            <ul className="sino-lista">
              {itens.map((n) => {
                const corpo = (
                  <>
                    <span className="sino-icone" aria-hidden="true">
                      {ICONE[n.tipo] ?? '•'}
                    </span>
                    <span className="sino-texto">
                      <span className="sino-titulo">{n.titulo}</span>
                      {n.descricao && <span className="sino-desc">{n.descricao}</span>}
                      <span className="sino-quando">{haQuanto(n.criado_em)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className={n.lida_em ? '' : 'sino-nova'}>
                    {n.solicitacao_id ? (
                      <Link href={`/painel/${n.solicitacao_id}`} onClick={() => setAberto(false)}>
                        {corpo}
                      </Link>
                    ) : (
                      <span className="sino-item-estatico">{corpo}</span>
                    )}
                  </li>
                );
              })}
              {itens.length === 0 && (
                <li className="sino-vazio">Nenhuma notificação por aqui.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-ponto" />
          {toast}
        </div>
      )}
    </>
  );
}
