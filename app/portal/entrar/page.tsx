import { redirect } from 'next/navigation';
import { sessaoPortal } from '@/lib/portal-auth';
import Entrar from './Entrar';

export const dynamic = 'force-dynamic';

export default async function PaginaEntrarPortal() {
  if (await sessaoPortal()) redirect('/portal');
  return <Entrar />;
}
