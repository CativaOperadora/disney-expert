import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { temaDoUsuario } from '@/lib/tema';

/**
 * Poppins é a fonte da marca Cativa.
 * 400 para corpo, 500 para rótulos, 600 para títulos e assinatura.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--fonte',
});

export const metadata: Metadata = {
  title: 'Planejador de viagem · Orlando',
  description:
    'Algumas perguntas para o seu consultor montar a viagem certa para vocês.',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#004b8a',
};

/**
 * O tema é resolvido no SERVIDOR e escrito no <html> antes de o HTML
 * chegar ao navegador. Fazer isso no cliente causaria um lampejo de tela
 * clara em quem escolheu escuro — o conteúdo pinta antes do JavaScript
 * rodar. Sem `data-tema` (preferência "sistema"), o CSS cai no
 * prefers-color-scheme e o navegador decide sozinho, também sem lampejo.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tema = await temaDoUsuario();

  return (
    <html
      lang="pt-BR"
      className={poppins.variable}
      {...(tema === 'claro' || tema === 'escuro' ? { 'data-tema': tema } : {})}
    >
      <body>{children}</body>
    </html>
  );
}
