'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS = [
  ['novo', 'Novo'],
  ['triagem', 'Triagem'],
  ['em_analise', 'Em análise'],
  ['consultoria_entregue', 'Consultoria entregue'],
  ['com_agencia', 'Com a agência'],
  ['follow_up', 'Follow-up'],
  ['ganho', 'Reserva confirmada'],
  ['perdido', 'Perdido'],
] as const;

const MOTIVOS = [
  ['sem_retorno_agencia', 'Sem retorno da agência'],
  ['cliente_desistiu', 'Cliente desistiu'],
  ['perdido_concorrencia', 'Perdido para concorrência'],
  ['fora_de_perfil', 'Fora de perfil'],
] as const;

export default function Acoes({
  id,
  statusAtual,
}: {
  id: string;
  statusAtual: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(statusAtual);
  const [motivo, setMotivo] = useState('sem_retorno_agencia');
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(corpo: any) {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/painel/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error();
      router.refresh();
      return true;
    } catch {
      setErro('Não foi possível salvar. Tente de novo.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="caixa">
      <h2 className="caixa-titulo">Ações</h2>

      {erro && <div className="erro-caixa">{erro}</div>}

      <div className="campo">
        <label className="rotulo" htmlFor="status">Situação do atendimento</label>
        <select
          id="status"
          className="entrada"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUS.map(([v, r]) => (
            <option key={v} value={v}>{r}</option>
          ))}
        </select>
      </div>

      {status === 'perdido' && (
        <div className="campo">
          <label className="rotulo" htmlFor="motivo">Motivo</label>
          <select
            id="motivo"
            className="entrada"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            {MOTIVOS.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="botao botao-principal"
        disabled={salvando || status === statusAtual}
        onClick={() =>
          chamar({ acao: 'status', status, motivo: status === 'perdido' ? motivo : null })
        }
      >
        {salvando ? 'Salvando…' : 'Salvar situação'}
      </button>

      <div className="campo" style={{ marginTop: 28 }}>
        <label className="rotulo" htmlFor="nota">Anotação</label>
        <span className="ajuda">
          Fica na linha do tempo. Registre o que foi orientado à agência.
        </span>
        <textarea
          id="nota"
          className="entrada"
          rows={4}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      </div>

      <button
        className="botao botao-voltar"
        disabled={salvando || nota.trim().length < 2}
        onClick={async () => {
          if (await chamar({ acao: 'comentario', texto: nota.trim() })) setNota('');
        }}
      >
        Registrar anotação
      </button>
    </section>
  );
}
