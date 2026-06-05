// app/layout.tsx — Root layout com metadados e fontes

import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agents na Saúde — Tutor de Enfermagem',
  description:
    'Chatbot educacional de enfermagem com IA (CRAG) para o projeto de Mestrado Agents na Saúde. Respostas precisas baseadas em material acadêmico.',
  keywords: [
    'enfermagem',
    'tutor IA',
    'RAG',
    'CRAG',
    'educação em saúde',
    'mestrado',
  ],
  authors: [{ name: 'Agents na Saúde' }],
  robots: 'noindex, nofollow', // Projeto acadêmico — não indexar
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
