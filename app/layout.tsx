import type { Metadata, Viewport } from 'next';
import { Fraunces } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500'],
  display: 'swap',
  variable: '--fonte-display',
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
  themeColor: '#1b2a4a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}
