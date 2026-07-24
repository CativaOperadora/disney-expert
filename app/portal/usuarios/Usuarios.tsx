'use client';

import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';

interface U {
  id: string;
  nome: string;
  email: string;
  admin: boolean;
  ativo: boolean;
  solicitacoes: number;
  ultimoFmt: string;
}

export default function Usuarios({ usuarios, meuId }: { usuarios: U[]; meuId: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // criação
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', admin: false });
  // edição / senha por linha
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ nome: '', email: '', admin: false });
  const [senhaId, setSenhaId] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState('');

  async function chamar(corpo: any): Promise<boolean> {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/portal/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro ?? 'Falha ao salvar.');
      }
      router.refresh();
      return true;
    } catch (e: any) {
      setErro(e?.message ?? 'Falha ao salvar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (await chamar({ acao: 'criar', ...novo })) {
      setNovo({ nome: '', email: '', senha: '', admin: false });
    }
  }

  function abrirEdicao(u: U) {
    setSenhaId(null);
    setEditId(u.id);
    setEdit({ nome: u.nome, email: u.email, admin: u.admin });
  }

  return (
    <>
      {erro && <div className="erro-caixa">{erro}</div>}

      <section className="cartao-bi" style={{ marginBottom: 18 }}>
        <h3 className="cartao-bi-titulo">Novo usuário</h3>
        <form className="usuario-form" onSubmit={criar}>
          <input className="entrada" placeholder="Nome" value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
          <input className="entrada" type="email" placeholder="E-mail" value={novo.email}
            onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
          <input className="entrada" type="password" placeholder="Senha (mín. 6)" value={novo.senha}
            onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required />
          <label className="usuario-admin">
            <input type="checkbox" checked={novo.admin}
              onChange={(e) => setNovo({ ...novo, admin: e.target.checked })} />
            Administrador
          </label>
          <button className="botao botao-principal" type="submit" disabled={ocupado}>
            Criar acesso
          </button>
        </form>
      </section>

      <div className="portal-tabela-wrap">
        <table className="portal-tabela">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>Papel</th>
              <th className="col-num">Solicitações</th><th>Último acesso</th>
              <th>Status</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <Fragment key={u.id}>
                <tr className={u.ativo ? '' : 'usuario-inativo'}>
                  <td>{u.nome}{u.id === meuId && <span className="voce-tag">você</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.admin ? <span className="selo-admin">Admin</span> : 'Agente'}</td>
                  <td className="col-num">{u.solicitacoes}</td>
                  <td>{u.ultimoFmt}</td>
                  <td>
                    <span className={`status-tag ${u.ativo ? 'status-venda_finalizada' : 'status-venda_perdida'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="usuario-acoes">
                    <button className="link-acao" onClick={() => abrirEdicao(u)}>Editar</button>
                    <button className="link-acao" onClick={() => { setEditId(null); setSenhaId(u.id); setNovaSenha(''); }}>Senha</button>
                    <button
                      className="link-acao"
                      disabled={ocupado || (u.id === meuId && u.ativo)}
                      onClick={() => chamar({ acao: 'ativar', id: u.id, ativo: !u.ativo })}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>

                {editId === u.id && (
                  <tr key={u.id + '-edit'} className="usuario-linha-edit">
                    <td colSpan={7}>
                      <div className="usuario-form">
                        <input className="entrada" value={edit.nome}
                          onChange={(e) => setEdit({ ...edit, nome: e.target.value })} placeholder="Nome" />
                        <input className="entrada" type="email" value={edit.email}
                          onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="E-mail" />
                        <label className="usuario-admin">
                          <input type="checkbox" checked={edit.admin}
                            onChange={(e) => setEdit({ ...edit, admin: e.target.checked })} />
                          Administrador
                        </label>
                        <button className="botao botao-principal" disabled={ocupado}
                          onClick={async () => { if (await chamar({ acao: 'editar', id: u.id, ...edit })) setEditId(null); }}>
                          Salvar
                        </button>
                        <button className="botao botao-voltar" onClick={() => setEditId(null)}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}

                {senhaId === u.id && (
                  <tr className="usuario-linha-edit">
                    <td colSpan={7}>
                      <div className="usuario-form">
                        <input className="entrada" type="password" placeholder="Nova senha (mín. 6)"
                          value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
                        <button className="botao botao-principal" disabled={ocupado || novaSenha.length < 6}
                          onClick={async () => { if (await chamar({ acao: 'senha', id: u.id, senha: novaSenha })) { setSenhaId(null); setNovaSenha(''); } }}>
                          Redefinir senha
                        </button>
                        <button className="botao botao-voltar" onClick={() => setSenhaId(null)}>Cancelar</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
