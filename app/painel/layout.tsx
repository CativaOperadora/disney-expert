import { redirect } from 'next/navigation';
import { sessaoValida } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await sessaoValida())) redirect('/entrar');
  return <>{children}</>;
}
