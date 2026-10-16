import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wordle Duel - Competitive English Wordle (4 to 10 Letters)',
  description: 'Play English Wordle solo or duel with friends in real-time lobbies! Configurable 4 to 10 letters, Google Sign-in, Head-to-Head record tracking, and guest play.',
  keywords: ['wordle', 'wordle multiplayer', 'word game', 'wordle 4 letters', 'wordle 10 letters', 'wordle duel'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} min-h-full bg-slate-950 text-slate-100 flex flex-col antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
