'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { avaliarSenha, MIN_SENHA } from '@/lib/senha';
import { ACCEPT_ARQUIVO, LIMITE_MB } from '@/lib/anexos-limites';

/**
 * Preferências do usuário, para os dois públicos.
 *
 * O tema é aplicado na hora, antes mesmo de salvar, escrevendo
 * data-tema no <html>. Assim a pessoa vê o resultado enquanto escolhe,
 * em vez de salvar às cegas e recarregar.
 */

type Tema = 'claro' | 'escuro' | 'sistema';

interface Prefs {
  nome: string;
  email: string;
  foto: string | null;
  tema: Tema;
  celebracao: boolean;
}

const TEMAS: { id: Tema; rotulo: string; dica: string }[] = [
  { id: 'claro', rotulo: 'Claro', dica: 'Fundo branco' },
  { id: 'escuro', rotulo: 'Escuro', dica: 'Fundo escuro' },
  { id: 'sistema', rotulo: 'Sistema', dica: 'Segue o aparelho' },
];

const iniciais = (n: string) =>
  n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

/** Escreve o tema no documento para efeito imediato. */
function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
}

export default function Preferencias({ voltarPara }: { voltarPara: string }) {
  const router = useRouter();
  const [p, setP] = useState<Prefs | null>(null);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [senhaMsg, setSenhaMsg] = useState<string | null>(null);
  const [senhaErro, setSenhaErro] = useState<string | null>(null);

  const forca = avaliarSenha(nova);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/preferencias');
      if (!r.ok) return;
      const d = await r.json();
      if (d.preferencias) setP(d.preferencias);
    })();
  }, []);

  function avisar(msg: string) {
    setSalvo(msg);
    setTimeout(() => setSalvo(null), 2500);
  }

  async function salvarPerfil(mudanca: Partial<Prefs>) {
    if (!p) return;
    const novo = { ...p, ...mudanca };
    setP(novo);
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch('/api/preferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'perfil',
          nome: novo.nome,
          tema: novo.tema,
          celebracao: novo.celebracao,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.erro);
      }
      avisar('Preferências salvas');
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível salvar.');
    } finally {
      setOcupado(false);
    }
  }

  async function enviarFoto(arquivo: File | null, remover = false) {
    setOcupado(true);
    setErro(null);
    try {
      const dados = new FormData();
      if (remover) dados.append('remover', '1');
      else if (arquivo) dados.append('foto', arquivo);
      const r = await fetch('/api/preferencias', { method: 'POST', body: dados });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro);
      setP((x) => (x ? { ...x, foto: d.foto ?? null } : x));
      avisar(remover ? 'Foto removida' : 'Foto atualizada');
      router.refresh();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível atualizar a foto.');
    } finally {
      setOcupado(false);
    }
  }

  async function enviarSenha() {
    setSenhaErro(null);
    setSenhaMsg(null);
    try {
      const r = await fetch('/api/preferencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'senha', atual, nova, confirmacao }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro);
      setAtual(''); setNova(''); setConfirmacao('');
      setSenhaMsg('Senha alterada com sucesso.');
    } catch (e: any) {
      setSenhaErro(e?.message || 'Não foi possível alterar a senha.');
    }
  }

  if (!p) {
    return (
      <main className="portal portal-estreito">
        <p className="portal-nota">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="portal portal-estreito">
      <div className="portal-topo">
        <div>
          <h1 className="portal-titulo">Editar meu perfil</h1>
          <p className="portal-sub">Seus dados, aparência e senha.</p>
        </div>
        <a href={voltarPara} className="portal-limpar">← Voltar</a>
      </div>

      {erro && <div className="erro-caixa">{erro}</div>}
      {salvo && <div className="pref-salvo">{salvo}</div>}

      {/* ---- identidade ---- */}
      <section className="cartao-bi">
        <h3 className="cartao-bi-titulo">Perfil</h3>

        <div className="pref-foto-linha">
          {p.foto ? (
            <img className="pref-foto" src={`/api/foto/${p.foto}`} alt="" />
          ) : (
            <span className="pref-foto pref-foto-vazia" aria-hidden="true">
              {iniciais(p.nome)}
            </span>
          )}

          <div className="pref-foto-acoes">
            <label className="botao botao-voltar pref-botao-arquivo">
              {p.foto ? 'Trocar foto' : 'Enviar foto'}
              <input
                type="file"
                accept={ACCEPT_ARQUIVO}
                disabled={ocupado}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) enviarFoto(f);
                  e.target.value = '';
                }}
              />
            </label>
            {p.foto && (
              <button
                className="portal-limpar"
                type="button"
                disabled={ocupado}
                onClick={() => enviarFoto(null, true)}
              >
                Remover
              </button>
            )}
            <span className="ajuda">JPG, PNG, GIF ou WEBP, até {LIMITE_MB} MB.</span>
          </div>
        </div>

        <div className="campo" style={{ marginTop: 22 }}>
          <label className="rotulo" htmlFor="pref-nome">Nome</label>
          <input
            id="pref-nome"
            className="entrada"
            value={p.nome}
            onChange={(e) => setP({ ...p, nome: e.target.value })}
            onBlur={() => p.nome.trim().length >= 2 && salvarPerfil({})}
          />
        </div>

        <div className="campo">
          <label className="rotulo">E-mail</label>
          <input className="entrada" value={p.email} disabled />
          <span className="ajuda">
            O e-mail é o seu login e só o administrador pode alterá-lo.
          </span>
        </div>
      </section>

      {/* ---- aparência ---- */}
      <section className="cartao-bi" style={{ marginTop: 16 }}>
        <h3 className="cartao-bi-titulo">Aparência</h3>

        <div className="pref-temas">
          {TEMAS.map((t) => (
            <label className="pref-tema" key={t.id}>
              <input
                type="radio"
                name="tema"
                checked={p.tema === t.id}
                onChange={() => {
                  aplicarTema(t.id);
                  salvarPerfil({ tema: t.id });
                }}
              />
              <span className="pref-tema-face">
                <span className={`pref-tema-amostra amostra-${t.id}`} aria-hidden="true" />
                <span>
                  <span className="pref-tema-rot">{t.rotulo}</span>
                  <span className="pref-tema-dica">{t.dica}</span>
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="pref-switch">
          <input
            type="checkbox"
            checked={p.celebracao}
            onChange={(e) => salvarPerfil({ celebracao: e.target.checked })}
          />
          <span>
            <strong>Animação de comemoração</strong>
            <span className="ajuda">
              Mostra uma comemoração ao concluir uma venda.
            </span>
          </span>
        </label>
      </section>

      {/* ---- senha ---- */}
      <section className="cartao-bi" style={{ marginTop: 16 }}>
        <h3 className="cartao-bi-titulo">Alterar senha</h3>

        {senhaErro && <div className="erro-caixa">{senhaErro}</div>}
        {senhaMsg && <div className="pref-salvo">{senhaMsg}</div>}

        <div className="campo">
          <label className="rotulo" htmlFor="s-atual">Senha atual</label>
          <input
            id="s-atual" className="entrada" type="password"
            autoComplete="current-password"
            value={atual} onChange={(e) => setAtual(e.target.value)}
          />
        </div>

        <div className="campo">
          <label className="rotulo" htmlFor="s-nova">Nova senha</label>
          <input
            id="s-nova" className="entrada" type="password"
            autoComplete="new-password"
            value={nova} onChange={(e) => setNova(e.target.value)}
          />
          {nova.length > 0 && (
            <ul className="pref-regras">
              <li className={forca.temTamanho ? 'ok' : ''}>
                {forca.temTamanho ? '✓' : '○'} Ao menos {MIN_SENHA} caracteres
              </li>
              <li className={forca.temEspecial ? 'ok' : ''}>
                {forca.temEspecial ? '✓' : '○'} Ao menos 1 caractere especial
              </li>
            </ul>
          )}
        </div>

        <div className="campo">
          <label className="rotulo" htmlFor="s-conf">Confirmar nova senha</label>
          <input
            id="s-conf" className="entrada" type="password"
            autoComplete="new-password"
            value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
          />
          {confirmacao.length > 0 && nova !== confirmacao && (
            <span className="erro">As senhas não conferem.</span>
          )}
        </div>

        <button
          className="botao botao-principal"
          disabled={!atual || !forca.ok || nova !== confirmacao}
          onClick={enviarSenha}
        >
          Alterar senha
        </button>
      </section>
    </main>
  );
}
