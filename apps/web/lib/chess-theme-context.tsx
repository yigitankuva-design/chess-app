'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  ChessThemeId,
  ChessTheme,
  DEFAULT_THEME_ID,
  getTheme,
} from './chess-themes';

interface ChessThemeContextValue {
  themeId: ChessThemeId;
  theme: ChessTheme;
  setTheme: (id: ChessThemeId) => void;
}

const ChessThemeContext = createContext<ChessThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  theme: getTheme(DEFAULT_THEME_ID),
  setTheme: () => {},
});

export function ChessThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ChessThemeId>(DEFAULT_THEME_ID);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('chess-theme');
      const validIds: string[] = ['classic', 'night', 'neon'];
      const resolved = (stored && validIds.includes(stored) ? stored : DEFAULT_THEME_ID) as ChessThemeId;
      if (resolved !== DEFAULT_THEME_ID || stored === DEFAULT_THEME_ID) {
        setThemeId(resolved);
      }
      document.documentElement.setAttribute('data-chess-theme', resolved);
      if (!stored || !validIds.includes(stored)) {
        document.documentElement.setAttribute('data-chess-theme', DEFAULT_THEME_ID);
      }
    } catch {
      // SSR / localStorage unavailable
    }
  }, []);

  function setTheme(id: ChessThemeId) {
    setThemeId(id);
    try {
      localStorage.setItem('chess-theme', id);
    } catch {
      // ignore
    }
    document.documentElement.setAttribute('data-chess-theme', id);
  }

  const theme = getTheme(themeId);

  // Prevent flash before hydration
  if (!mounted) {
    return (
      <ChessThemeContext.Provider
        value={{ themeId: DEFAULT_THEME_ID, theme: getTheme(DEFAULT_THEME_ID), setTheme: () => {} }}
      >
        {children}
      </ChessThemeContext.Provider>
    );
  }

  return (
    <ChessThemeContext.Provider value={{ themeId, theme, setTheme }}>
      {children}
    </ChessThemeContext.Provider>
  );
}

export function useChessTheme() {
  return useContext(ChessThemeContext);
}
