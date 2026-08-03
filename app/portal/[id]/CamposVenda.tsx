'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatarBRL } from '@/lib/valores';

/**
 * Campos de venda editáveis pelo Portal — espelham os do CRM da consultoria
 * (app/painel/[id]/Acoes.tsx), limitados a valor total e ID da reserva.
 *
 * A situação do atendimento não é editável aqui: quem move a solicitação
 * entre as etapas continua sendo a consultoria, no CRM interno.
 */
export default function CamposVenda({
  id,
  valorVenda: valorInicial,
  idReserva: reservaInicial,
  ganha,
}: {
  id: string;
  valorVenda: string | null;
  idReserva: string | null;
  ganha: boolean;
}) {
  const router = useRouter();
  const inicialFmt = valorInicial != null ? formatarBRL(Number(valorInicial)) : '';

  const [valor, setValor] = useState(inicialFmt);
  const [reserva, setReserva] = useState(reservaInicial ?? '');
  const [salvandoValor, setSalvandoValor] = useState(false);
  const [valorSalvo, setValorSalvo] = useState(false);
  const [salvandoReserva, setSalvandoReserva] = useState(false);
  const [reservaSalva, setReservaSalva] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(
    corpo: any,
    setLoading: (b: boolean) => void,
    setDone: (b: boolean) => void,
    msgErro: string,
  ) {
    setLoading(true);
    setDone(false);
    setErro(null);
    try {
      const r = await fetch(`/api/portal/solicitacoes/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro);
      }
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || msgErro);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {erro && <div className="erro-caixa">{erro}</div>}

      {!ganha && (
        <p className="portal-nota" style={{ marginBottom: 18 }}>
          Atendimento em andamento. O valor registrado aqui entra no faturamento
          e no ticket médio do dashboard quando a consultoria concluir a venda.
        </p>
      )}

      {/* --- Valor total da venda --- */}
      <div className="campo">
        <label className="rotulo" htmlFor="valor_venda">Valor total da venda</label>
        <span className="ajuda">Base dos indicadores financeiros do seu dashboard.</span>
        <div className="entrada-prefixo">
          <span className="prefixo">R$</span>
          <input
            id="valor_venda"
            className="entrada"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setValorSalvo(false);
            }}
          />
        </div>
      </div>

      <button
        className="botao botao-voltar"
        disabled={salvandoValor || valor.trim() === inicialFmt}
        onClick={() =>
          salvar(
            { acao: 'valor_venda', valor: valor.trim() },
            setSalvandoValor,
            setValorSalvo,
            'Não foi possível salvar o valor. Tente de novo.',
          )
        }
      >
        {salvandoValor ? 'Salvando…' : valorSalvo ? 'Valor salvo ✓' : 'Salvar valor'}
      </button>

      {/* --- ID da reserva --- */}
      <div className="campo" style={{ marginTop: 28 }}>
        <label className="rotulo" htmlFor="id_reserva">ID da reserva</label>
        <span className="ajuda">Editável a qualquer momento.</span>
        <input
          id="id_reserva"
          className="entrada"
          type="text"
          placeholder="Ex.: RES-2027-00123"
          value={reserva}
          onChange={(e) => {
            setReserva(e.target.value);
            setReservaSalva(false);
          }}
        />
      </div>

      <button
        className="botao botao-voltar"
        disabled={salvandoReserva || reserva.trim() === (reservaInicial ?? '').trim()}
        onClick={() =>
          salvar(
            { acao: 'id_reserva', valor: reserva.trim() },
            setSalvandoReserva,
            setReservaSalva,
            'Não foi possível salvar o ID da reserva. Tente de novo.',
          )
        }
      >
        {salvandoReserva ? 'Salvando…' : reservaSalva ? 'ID da reserva salvo ✓' : 'Salvar ID da reserva'}
      </button>
    </>
  );
}
