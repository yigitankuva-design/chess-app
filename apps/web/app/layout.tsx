import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ChessThemeProvider } from '@/lib/chess-theme-context';
import { BoardNotationProvider } from '@/lib/board-notation-context';
import { SettingsProvider } from '@/lib/settings/settings-context';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Bozüyük Satranç Akademisi',
  description: 'Bozüyük Satranç Akademisi — Akademik Gelişim Platformu',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" data-chess-theme="neon">
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-blue-600 focus:text-white focus:rounded"
        >
          İçeriğe geç
        </a>
        <SettingsProvider>
          <ChessThemeProvider>
            <BoardNotationProvider>
              <AuthProvider>{children}</AuthProvider>
            </BoardNotationProvider>
          </ChessThemeProvider>
        </SettingsProvider>
        <ThemeToggle />
      </body>
    </html>
  );
}
