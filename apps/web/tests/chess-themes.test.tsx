import { renderHook, waitFor } from '@testing-library/react';
import { CHESS_THEMES, getTheme } from '@/lib/chess-themes';
import { ChessThemeProvider, useChessTheme } from '@/lib/chess-theme-context';

/** Madde 2026-09-19: Kağıt/Mercan/Erik temaları eklendi (mevcut
 *  Klasik/Gece/Neon/Sakin'in yanına). Bu test hem verinin eksiksiz
 *  olduğunu hem de chess-theme-context'teki elle yazılmış geçerli-id
 *  listesinin (bkz. lib/chess-theme-context.tsx) güncellendiğini doğrular
 *  — o liste unutulursa yeni tema localStorage'dan geri yüklenirken
 *  sessizce varsayılana ('sakin') döner. */

const NEW_THEME_IDS = ['kagit', 'mercan', 'erik'] as const;

describe('chess-themes — yeni tema verisi', () => {
  it('3 yeni tema CHESS_THEMES içinde eksiksiz tanımlı', () => {
    for (const id of NEW_THEME_IDS) {
      const theme = CHESS_THEMES.find((t) => t.id === id);
      expect(theme).toBeDefined();
      expect(theme!.name.length).toBeGreaterThan(0);
      expect(theme!.emoji.length).toBeGreaterThan(0);
      expect(theme!.description.length).toBeGreaterThan(0);
      expect(theme!.lightSquare).toMatch(/^#/);
      expect(theme!.darkSquare).toMatch(/^#/);
      expect(theme!.lightSquare).not.toBe(theme!.darkSquare);
    }
  });

  it('getTheme yeni id\'ler için doğru temayı döner', () => {
    for (const id of NEW_THEME_IDS) {
      expect(getTheme(id).id).toBe(id);
    }
  });

  it('toplamda 7 tema var (4 eski + 3 yeni), id\'ler benzersiz', () => {
    expect(CHESS_THEMES).toHaveLength(7);
    const ids = CHESS_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ChessThemeProvider>{children}</ChessThemeProvider>;
}

describe('chess-theme-context — yeni temalar localStorage\'dan geri yüklenir', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-chess-theme');
  });

  it.each(NEW_THEME_IDS)('localStorage\'da "%s" kayıtlıysa sayfa açılışında o tema aktif olur (varsayılana dönmez)', async (id) => {
    localStorage.setItem('chess-theme', id);

    const { result } = renderHook(() => useChessTheme(), { wrapper });

    await waitFor(() => expect(result.current.themeId).toBe(id));
    expect(document.documentElement.getAttribute('data-chess-theme')).toBe(id);
  });
});
