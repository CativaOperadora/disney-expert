import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
