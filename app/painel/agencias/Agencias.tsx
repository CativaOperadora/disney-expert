'use client';

import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';

interface A {
  id: string;
  nome: string;
  tier: string;
  ativa: boolean;
  total_agentes: number;
  solicitacoes: number;
  admin_nome: string | null;
  admin_email: string | null;
  criadoFmt: string;
}

const VAZIO = { nomeAgencia: '', tier: 'padrao', nomeAdmin: '', emailAdmin: '', senha: '' };

export default function Agencias({ agencias }: { agencias: A[] }) {
  const router = useRouter();
  const [nova, setNova] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function chamar(corpo: any): Promise<any> {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/painel/agencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? 'Falha ao salvar.');
      router.refresh();
      return d;
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao salvar.');
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const d = await chamar({ acao: 'criar', ...nova });
    if (d?.ok) {
      setMsg(
        `Agência criada! O administrador ${nova.nomeAdmin} já pode entrar em /portal/entrar ` +
          `com ${nova.emailAdmin}. Link de formulário gerado automaticamente (código ${d.codigo}).`,
      );
      setNova(VAZIO);
    }
  }

  return (
    <>
      {erro && <div className="erro-caixa">{erro}</div>}
      {msg && <div className="ok-caixa">{msg}</div>}

      <section className="cartao-bi" style={{ marginBottom: 18 }}>
        <h3 className="cartao-bi-titulo">Nova agência</h3>
        <form className="usuario-form" onSubmit={criar}>
          <input className="entrada" placeholder="Nome da agência" value={nova.nomeAgencia}
            onChange={(e) => setNova({ ...nova, nomeAgencia: e.target.value })} required />
          <select className="entrada" value={nova.tier}
            onChange={(e) => setNova({ ...nova, tier: e.target.value })}>
            <option value="padrao">Padrão (SLA 48h)</option>
            <option value="select">Select (SLA 24h)</option>
          </select>
          <input className="entrada" placeholder="Nome do administrador" value={nova.nomeAdmin}
            onChange={(e) => setNova({ ...nova, nomeAdmin: e.target.value })} required />
          <input className="entrada" type="email" placeholder="E-mail do administrador" value={nova.emailAdmin}
            onChange={(e) => setNova({ ...nova, emailAdmin: e.target.value })} required />
          <input className="entrada" type="password" placeholder="Senha inicial (mín. 6)" value={nova.senha}
            onChange={(e) => setNova({ ...nova, senha: e.target.value })} required />
          <button className="botao botao-principal" type="submit" disabled={ocupado}>
            Criar agência
          </button>
        </form>
        <p className="portal-nota" style={{ marginTop: 10 }}>
          Ao criar, o sistema gera a organização, o usuário administrador (com
          permissões de admin), o link exclusivo de formulário e o QR Code. Depois,
          o próprio administrador cria seus agentes no Portal.
        </p>
      </section>

      <div className="portal-tabela-wrap">
        <table className="portal-tabela">
          <thead>
            <tr>
              <th>Agência</th>
              <th>Administrador</th>
              <th>Tier</th>
              <th className="col-num">Agentes</th>
              <th className="col-num">Solicitações</th>
              <th>Criada</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {agencias.map((a) => (
              <Fragment key={a.id}>
                <tr className={a.ativa ? '' : 'usuario-inativo'}>
                  <td><span className="rank-nome">{a.nome}</span></td>
                  <td>
                    <span className="rank-nome">{a.admin_nome ?? '—'}</span>
                    {a.admin_email && <span className="rank-sub">{a.admin_email}</span>}
                  </td>
                  <td>
                    {a.tier === 'select'
                      ? <span className="selo-select">Select</span>
                      : <span className="rank-sub">Padrão</span>}
                  </td>
                  <td className="col-num">{a.total_agentes}</td>
                  <td className="col-num">{a.solicitacoes}</td>
                  <td>{a.criadoFmt}</td>
                  <td>
                    <span className={`status-tag ${a.ativa ? 'status-venda_finalizada' : 'status-venda_perdida'}`}>
                      {a.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="usuario-acoes">
                    <button
                      className="link-acao"
                      disabled={ocupado}
                      onClick={() => chamar({ acao: 'ativar', id: a.id, ativa: !a.ativa })}
                    >
                      {a.ativa ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              </Fragment>
            ))}
            {agencias.length === 0 && (
              <tr><td colSpan={8} className="portal-vazio">Nenhuma agência cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
