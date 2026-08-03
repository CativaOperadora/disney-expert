'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS, MOTIVOS_PERDA } from '@/lib/sla';
import { formatarBRL } from '@/lib/valores';

export default function Acoes({
  id,
  statusAtual,
  idReserva: idReservaInicial,
  valorVenda: valorVendaInicial,
  responsavelId: responsavelInicial,
  consultoras,
}: {
  id: string;
  statusAtual: string;
  idReserva: string | null;
  valorVenda: string | null;
  responsavelId: string | null;
  consultoras: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(statusAtual);
  const [motivo, setMotivo] = useState('sem_retorno_agencia');
  const [nota, setNota] = useState('');
  const [idReserva, setIdReserva] = useState(idReservaInicial ?? '');
  const [valor, setValor] = useState(
    valorVendaInicial != null ? formatarBRL(Number(valorVendaInicial)) : '',
  );
  const [responsavel, setResponsavel] = useState(responsavelInicial ?? '');
  const [salvandoReserva, setSalvandoReserva] = useState(false);
  const [reservaSalva, setReservaSalva] = useState(false);
  const [salvandoValor, setSalvandoValor] = useState(false);
  const [valorSalvo, setValorSalvo] = useState(false);
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
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro);
      }
      router.refresh();
      return true;
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar. Tente de novo.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSimples(
    corpo: any,
    setLoading: (b: boolean) => void,
    setDone: (b: boolean) => void,
    msgErro: string,
  ) {
    setLoading(true);
    setDone(false);
    setErro(null);
    try {
      const r = await fetch(`/api/painel/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      setErro(msgErro);
    } finally {
      setLoading(false);
    }
  }

  const fechandoVenda = status === 'venda_finalizada';
  const valorVazio = valor.trim() === '';

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
          {STATUS.map((s) => (
            <option key={s.id} value={s.id}>{s.titulo}</option>
          ))}
        </select>
      </div>

      {status === 'venda_perdida' && (
        <div className="campo">
          <label className="rotulo" htmlFor="motivo">Motivo</label>
          <select
            id="motivo"
            className="entrada"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          >
            {MOTIVOS_PERDA.map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {fechandoVenda && valorVazio && (
        <p className="ajuda" style={{ color: 'var(--erro)' }}>
          Informe o valor total da venda abaixo para poder fechar.
        </p>
      )}

      <button
        className="botao botao-principal"
        disabled={salvando || status === statusAtual || (fechandoVenda && valorVazio)}
        onClick={() =>
          chamar({
            acao: 'status',
            status,
            motivo: status === 'venda_perdida' ? motivo : null,
            valor: fechandoVenda ? valor : undefined,
          })
        }
      >
        {salvando ? 'Salvando…' : 'Salvar situação'}
      </button>

      {/* --- Valor total da venda --- */}
      <div className="campo" style={{ marginTop: 28 }}>
        <label className="rotulo" htmlFor="valor_venda">Valor total da venda</label>
        <span className="ajuda">
          Preencha ao concluir a venda. Base dos indicadores financeiros.
        </span>
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
        disabled={
          salvandoValor ||
          valor.trim() ===
            (valorVendaInicial != null ? formatarBRL(Number(valorVendaInicial)) : '')
        }
        onClick={() =>
          salvarSimples(
            { acao: 'valor_venda', valor: valor.trim() },
            setSalvandoValor,
            setValorSalvo,
            'Não foi possível salvar o valor. Tente de novo.',
          )
        }
      >
        {salvandoValor ? 'Salvando…' : valorSalvo ? 'Valor salvo ✓' : 'Salvar valor'}
      </button>

      {/* --- Responsável (consultora) --- */}
      <div className="campo" style={{ marginTop: 28 }}>
        <label className="rotulo" htmlFor="responsavel">Responsável (consultora)</label>
        <span className="ajuda">Quem está conduzindo este atendimento.</span>
        <select
          id="responsavel"
          className="entrada"
          value={responsavel}
          onChange={(e) => {
            setResponsavel(e.target.value);
            chamar({ acao: 'responsavel', valor: e.target.value });
          }}
        >
          <option value="">Não atribuída</option>
          {consultoras.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* --- ID da Reserva --- */}
      <div className="campo" style={{ marginTop: 28 }}>
        <label className="rotulo" htmlFor="id_reserva">ID da Reserva</label>
        <span className="ajuda">
          Preencha quando a venda for concluída. Editável a qualquer momento.
        </span>
        <input
          id="id_reserva"
          className="entrada"
          type="text"
          placeholder="Ex.: RES-2027-00123"
          value={idReserva}
          onChange={(e) => {
            setIdReserva(e.target.value);
            setReservaSalva(false);
          }}
        />
      </div>

      <button
        className="botao botao-voltar"
        disabled={
          salvandoReserva ||
          idReserva.trim() === (idReservaInicial ?? '').trim()
        }
        onClick={() =>
          salvarSimples(
            { acao: 'id_reserva', valor: idReserva.trim() },
            setSalvandoReserva,
            setReservaSalva,
            'Não foi possível salvar o ID da Reserva. Tente de novo.',
          )
        }
      >
        {salvandoReserva
          ? 'Salvando…'
          : reservaSalva
            ? 'ID da Reserva salvo ✓'
            : 'Salvar ID da Reserva'}
      </button>

      {/* --- Anotação --- */}
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
