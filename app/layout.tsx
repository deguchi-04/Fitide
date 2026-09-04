import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'https://forma-pessoal.thaidy-deguchi.chatgpt.site'),
  title: 'Fitide — nutrição e treino',
  description: 'O teu painel pessoal de dieta, treino, jejum e progresso.',
  openGraph: {
    title: 'Fitide — nutrição e treino',
    description: 'Nutrição, treino e progresso num só lugar.',
    images: ['/og.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fitide — nutrição e treino',
    description: 'Nutrição, treino e progresso num só lugar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
