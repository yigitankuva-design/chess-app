'use client';
import { ReactNode } from 'react';
import { useChessTheme } from '@/lib/chess-theme-context';

export default function ChildLayout({ children }: { children: ReactNode }) {
  const { themeId } = useChessTheme();

  // Classic and kids themes get a lighter treatment for readability
  const useDefaultBg = themeId === 'classic' || themeId === 'kids';

  return (
    <div
      className={[
        'min-h-screen',
        useDefaultBg
          ? 'bg-gradient-to-b from-blue-50 to-white'
          : 'chess-page-bg',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
