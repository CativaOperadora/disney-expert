'use client';

import { useEffect, useState } from 'react';

/**
 * Comemoração ao concluir uma venda.
 *
 * Papéis gerados em CSS puro — nenhuma biblioteca de confete entra no
 * bundle por causa de 3 segundos de animação.
 *
 * Respeita duas coisas: a preferência do usuário (desligável em
 * Preferências) e `prefers-reduced-motion`, para quem tem sensibilidade a
 * movimento. A segunda é tratada no CSS, então vale mesmo se o
 * componente for reaproveitado em outro lugar.
 */

const CORES = ['#ffcd28', '#0ba7da', '#084987', '#1a7a52', '#e0bb4a'];

export default function Comemoracao({
  ligada,
  aoTerminar,
}: {
  ligada: boolean;
  aoTerminar?: () => void;
}) {
  const [papeis] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      esquerda: Math.round((i * 37 + (i % 7) * 11) % 100),
      atraso: ((i % 13) * 0.11).toFixed(2),
      duracao: (2.1 + (i % 9) * 0.16).toFixed(2),
      cor: CORES[i % CORES.length],
    })),
  );

  useEffect(() => {
    if (!ligada) return;
    const t = setTimeout(() => aoTerminar?.(), 3800);
    return () => clearTimeout(t);
  }, [ligada, aoTerminar]);

  if (!ligada) return null;

  return (
    <>
      <div className="festa" aria-hidden="true">
        {papeis.map((p) => (
          <span
            key={p.id}
            className="festa-papel"
            style={{
              left: `${p.esquerda}%`,
              background: p.cor,
              animationDelay: `${p.atraso}s`,
              animationDuration: `${p.duracao}s`,
            }}
          />
        ))}
      </div>
      <div className="festa-aviso" role="status">
        <strong>Venda finalizada! 🎉</strong>
        <span>Mais uma família a caminho de Orlando.</span>
      </div>
    </>
  );
}
