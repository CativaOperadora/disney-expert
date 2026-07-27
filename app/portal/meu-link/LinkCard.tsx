'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LinkCard({
  nome,
  agencia,
  url,
  codigo,
  qrSvg,
  ativo,
  admin = false,
  id,
}: {
  nome: string;
  agencia: string;
  url: string;
  codigo: string;
  qrSvg: string;
  ativo: boolean;
  admin?: boolean;
  id?: string;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }

  function baixarQr() {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `qr-formulario-${codigo}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }

  async function compartilhar() {
    try {
      await navigator.share({
        title: 'Formulário Orlando Expert',
        text: `Preencha seu diagnóstico de viagem para Orlando com ${nome} (${agencia}).`,
        url,
      });
    } catch {
      /* cancelado */
    }
  }

  async function alternarAtivo() {
    if (!id) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/portal/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'ativar', id, ativo: !ativo }),
      });
      if (r.ok) router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={`link-card ${ativo ? '' : 'inativo'}`}>
      <div className="link-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />

      <div className="link-info">
        <div className="link-topo">
          <div>
            <h3 className="link-nome">{nome}</h3>
            <p className="link-agencia">{agencia}</p>
          </div>
          {admin && (
            <span className={`status-tag ${ativo ? 'status-venda_finalizada' : 'status-venda_perdida'}`}>
              {ativo ? 'Ativo' : 'Inativo'}
            </span>
          )}
        </div>

        <div className="link-url" title={url}>{url}</div>

        <div className="link-acoes">
          <button className="botao botao-principal link-btn" onClick={copiar} type="button">
            {copiado ? 'Copiado ✓' : 'Copiar link'}
          </button>
          <a className="botao botao-voltar link-btn" href={url} target="_blank" rel="noopener noreferrer">
            Abrir
          </a>
          <button className="botao botao-voltar link-btn" onClick={baixarQr} type="button">
            Baixar QR
          </button>
          {podeCompartilhar && (
            <button className="botao botao-voltar link-btn" onClick={compartilhar} type="button">
              Compartilhar
            </button>
          )}
          {admin && id && (
            <button
              className="botao botao-voltar link-btn link-toggle"
              onClick={alternarAtivo}
              disabled={ocupado}
              type="button"
            >
              {ativo ? 'Desativar' : 'Reativar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
