'use client';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { BoardColorId, BOARD_COLOR_ORDER } from './boardColors';
import { PieceSetId, PIECE_SET_ORDER } from './pieceSets';

/**
 * Madde 2026-09-02: Profil sayfasındaki "Tahta Renklerini Değiştir" ve
 * "Taş Görünümünü Değiştir" kartları için — lib/chess-theme-context.tsx ile
 * AYNI desen: cihaza (localStorage) özel, hesaba bağlı değil. null = sporcu
 * henüz kişisel bir seçim yapmadı; bu durumda admin'in genel ayarı
 * (Admin > Ayarlar > Tahta, useSettings() üzerinden) DEĞİŞMEDEN uygulanır —
 * bkz. components/ChessBoard.tsx. Sporcu bir kez seçim yapınca admin
 * ayarının ÜSTÜNE biner.
 */

interface BoardPrefsContextValue {
  boardColorId: BoardColorId | null;
  setBoardColorId: (id: BoardColorId | null) => void;
  pieceSetId: PieceSetId | null;
  setPieceSetId: (id: PieceSetId | null) => void;
}

const BoardPrefsContext = createContext<BoardPrefsContextValue>({
  boardColorId: null,
  setBoardColorId: () => {},
  pieceSetId: null,
  setPieceSetId: () => {},
});

const BOARD_COLOR_KEY = 'board-color-id';
const PIECE_SET_KEY = 'piece-set-id';

export function BoardPrefsProvider({ children }: { children: ReactNode }) {
  const [boardColorId, setBoardColorIdState] = useState<BoardColorId | null>(null);
  const [pieceSetId, setPieceSetIdState] = useState<PieceSetId | null>(null);

  useEffect(() => {
    try {
      const storedColor = localStorage.getItem(BOARD_COLOR_KEY);
      if (storedColor && (BOARD_COLOR_ORDER as string[]).includes(storedColor)) {
        setBoardColorIdState(storedColor as BoardColorId);
      }
      const storedPieces = localStorage.getItem(PIECE_SET_KEY);
      if (storedPieces && (PIECE_SET_ORDER as string[]).includes(storedPieces)) {
        setPieceSetIdState(storedPieces as PieceSetId);
      }
    } catch {
      // SSR / localStorage kapalı
    }
  }, []);

  function setBoardColorId(id: BoardColorId | null) {
    setBoardColorIdState(id);
    try {
      if (id) localStorage.setItem(BOARD_COLOR_KEY, id);
      else localStorage.removeItem(BOARD_COLOR_KEY);
    } catch {
      // ignore
    }
  }

  function setPieceSetId(id: PieceSetId | null) {
    setPieceSetIdState(id);
    try {
      if (id) localStorage.setItem(PIECE_SET_KEY, id);
      else localStorage.removeItem(PIECE_SET_KEY);
    } catch {
      // ignore
    }
  }

  return (
    <BoardPrefsContext.Provider value={{ boardColorId, setBoardColorId, pieceSetId, setPieceSetId }}>
      {children}
    </BoardPrefsContext.Provider>
  );
}

export function useBoardPrefs() {
  return useContext(BoardPrefsContext);
}
