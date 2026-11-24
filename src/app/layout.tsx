import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DevArena — Club Dev ESGIS Bénin',
  description: 'Plateforme de défis de programmation chronométrés avec classement en temps réel.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}