'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

const STORAGE_KEY = 'chess-hide-board-notation';

interface BoardNotationContextValue {
  /** true ise tahtanın rakam/harf etiketleri gizlenir (madde 3). */
  hideNotation: boolean;
  toggleHideNotation: () => void;
}

const BoardNotationContext = createContext<BoardNotationContextValue>({
  hideNotation: false,
  toggleHideNotation: () => {},
});

/**
 * Sporcunun "Notasyon Verilerini Gizle" tercihi — tarayıcıda kalıcı (localStorage).
 * Yalnızca maç/pratik ekranlarında (BotGame, LiveGame) OKUNUR; ders/bulmaca
 * tahtaları bu tercihi kullanmaz, ChessBoard'un `hideNotation` prop'u varsayılan
 * olarak false kalır (KURAL #3 — geriye dönük uyumlu, diğer ekranlar etkilenmez).
 */
export function BoardNotationProvider({ children }: { children: ReactNode }) {
  const [hideNotation, setHideNotation] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setHideNotation(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // SSR / localStorage kullanılamıyor
    }
  }, []);

  function toggleHideNotation() {
    setHideNotation((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Hydration öncesi yanlış değerle yanıp sönmesin diye varsayılan (false) döner.
  if (!mounted) {
    return (
      <BoardNotationContext.Provider value={{ hideNotation: false, toggleHideNotation: () => {} }}>
        {children}
      </BoardNotationContext.Provider>
    );
  }

  return (
    <BoardNotationContext.Provider value={{ hideNotation, toggleHideNotation }}>
      {children}
    </BoardNotationContext.Provider>
  );
}

export function useBoardNotation() {
  return useContext(BoardNotationContext);
}
