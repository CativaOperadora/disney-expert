'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Anotação interna da agência.
 *
 * Espelha o "Registrar anotação" da consultoria e obedece à mesma
 * fronteira, no sentido oposto: grava um evento 'nota_agencia', que o CRM
 * interno não lê. O que a agência escreve sobre o cliente fica na agência.
 */
export default function NotaAgencia({ id }: { id: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/portal/solicitacoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'nota', texto: texto.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro);
      }
      setTexto('');
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível registrar a anotação.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="cartao-bi">
      <h3 className="cartao-bi-titulo">Anotação da equipe</h3>
      <p className="portal-nota" style={{ marginBottom: 12 }}>
        Fica na linha do tempo, visível apenas para a sua agência. A
        consultoria não lê estas anotações.
      </p>

      {erro && <div className="erro-caixa">{erro}</div>}

      <textarea
        className="entrada"
        rows={3}
        maxLength={4000}
        placeholder="Registre o combinado com o cliente, próximos passos…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button
        className="botao botao-voltar"
        style={{ marginTop: 10 }}
        disabled={salvando || texto.trim().length < 2}
        onClick={registrar}
      >
        {salvando ? 'Registrando…' : 'Registrar anotação'}
      </button>
    </section>
  );
}
