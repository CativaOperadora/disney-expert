import { redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import { listarUsuarios } from '@/lib/portal';
import PortalHeader from '../PortalHeader';
import Usuarios from './Usuarios';

export const dynamic = 'force-dynamic';

const DATA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export default async function PaginaUsuarios() {
  const sess = await sessaoPortal();
  if (!sess) redirect('/portal/entrar');
  if (!sess.admin) redirect('/portal');

  const lista = await listarUsuarios(sess);
  const usuarios = lista.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    admin: u.admin,
    ativo: u.ativo,
    solicitacoes: u.solicitacoes,
    ultimoFmt: u.ultimo_acesso ? DATA.format(new Date(u.ultimo_acesso)) : 'Nunca acessou',
  }));

  return (
    <div className="tela">
      <PortalHeader sess={sess} ativo="user" />
      <main className="portal">
        <div className="portal-topo">
          <div>
            <h1 className="portal-titulo">Usuários da agência</h1>
            <p className="portal-sub">
              Gerencie os acessos de {sess.agenciaNome}. Cada agente vê apenas as
              próprias solicitações; o administrador vê todas as da agência.
            </p>
          </div>
        </div>
        <Usuarios usuarios={usuarios} meuId={sess.agenteId} />
      </main>
    </div>
  );
}
