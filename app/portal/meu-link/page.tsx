import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarUsuarios } from '@/lib/portal';
import PortalHeader from '../PortalHeader';
import LinkCard from './LinkCard';

export const dynamic = 'force-dynamic';

function texto(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() !== '' ? s.trim() : null;
}

/** URL pública base: usa APP_URL; se ausente, deriva do request. */
async function baseUrl(): Promise<string> {
  const env = process.env.APP_URL?.replace(/\/$/, '');
  if (env) return env;
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${h.get('host')}`;
}

function qr(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    width: 200,
    color: { dark: '#16202b', light: '#ffffff' },
  });
}

export default async function MeuLink({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');

  const base = await baseUrl();

  // ---- Agente: apenas o próprio link ----
  if (!sess.admin) {
    const url = `${base}/f/${sess.codigo}`;
    const svg = await qr(url);
    return (
      <div className="tela">
        <PortalHeader sess={sess} />
        <main className="portal portal-estreito">
          <div className="portal-topo">
            <div>
              <h1 className="portal-titulo">Meu link de formulário</h1>
              <p className="portal-sub">
                Compartilhe com seus clientes. Toda resposta chega automaticamente
                vinculada a você e à {sess.agenciaNome}.
              </p>
            </div>
          </div>
          <LinkCard
            nome={sess.nome}
            agencia={sess.agenciaNome}
            url={url}
            codigo={sess.codigo}
            qrSvg={svg}
            ativo
          />
        </main>
      </div>
    );
  }

  // ---- Administrador: links de todos os agentes da agência ----
  const sp = await searchParams;
  const q = texto(sp.q);
  const usuarios = await listarUsuarios(sess);
  const filtrados = q
    ? usuarios.filter(
        (u) =>
          u.nome.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase()),
      )
    : usuarios;

  const cards = await Promise.all(
    filtrados.map(async (u) => {
      const url = `${base}/f/${u.codigo}`;
      return { u, url, svg: await qr(url) };
    }),
  );

  return (
    <div className="tela">
      <PortalHeader sess={sess} />
      <main className="portal">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">Links de formulário da agência</h1>
            <p className="portal-sub">
              O link e o QR Code de cada agente de {sess.agenciaNome}. Cada
              resposta é vinculada automaticamente ao agente correspondente.
            </p>
          </div>
          <Link href="/portal/usuarios" className="botao botao-principal portal-cta">
            + Criar agente
          </Link>
        </div>

        <form className="portal-filtros" method="get">
          <input
            className="entrada"
            type="search"
            name="q"
            placeholder="Pesquisar agente por nome ou e-mail"
            defaultValue={q ?? ''}
          />
          <button className="botao botao-voltar" type="submit">Buscar</button>
          {q && <Link href="/portal/meu-link" className="portal-limpar">Limpar</Link>}
        </form>

        <div className="link-grade">
          {cards.map(({ u, url, svg }) => (
            <LinkCard
              key={u.id}
              nome={u.nome}
              agencia={sess.agenciaNome}
              url={url}
              codigo={u.codigo}
              qrSvg={svg}
              ativo={u.ativo}
              admin
              id={u.id}
            />
          ))}
          {cards.length === 0 && (
            <p className="portal-nota">Nenhum agente encontrado.</p>
          )}
        </div>
      </main>
    </div>
  );
}
