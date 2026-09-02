import { renderHook, act, waitFor } from '@testing-library/react';
import { BoardPrefsProvider, useBoardPrefs } from '@/lib/board-prefs-context';

function wrapper({ children }: { children: React.ReactNode }) {
  return <BoardPrefsProvider>{children}</BoardPrefsProvider>;
}

describe('board-prefs-context — sporcunun cihazına özel tahta rengi/taş seti tercihi', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sağlayıcı olmadan varsayılan değerler null döner (admin ayarı bozulmaz)', () => {
    const { result } = renderHook(() => useBoardPrefs());
    expect(result.current.boardColorId).toBeNull();
    expect(result.current.pieceSetId).toBeNull();
  });

  it('bir tahta rengi seçilince localStorage\'a yazılır ve state güncellenir', async () => {
    const { result } = renderHook(() => useBoardPrefs(), { wrapper });
    await waitFor(() => expect(result.current.boardColorId).toBeNull());

    act(() => result.current.setBoardColorId('purple'));

    expect(result.current.boardColorId).toBe('purple');
    expect(localStorage.getItem('board-color-id')).toBe('purple');
  });

  it('bir taş seti seçilince localStorage\'a yazılır ve state güncellenir', async () => {
    const { result } = renderHook(() => useBoardPrefs(), { wrapper });
    await waitFor(() => expect(result.current.pieceSetId).toBeNull());

    act(() => result.current.setPieceSetId('merida'));

    expect(result.current.pieceSetId).toBe('merida');
    expect(localStorage.getItem('piece-set-id')).toBe('merida');
  });

  it('sayfa yeniden açıldığında (yeni provider) localStorage\'daki seçim geri yüklenir', async () => {
    localStorage.setItem('board-color-id', 'green');
    localStorage.setItem('piece-set-id', 'chessnut');

    const { result } = renderHook(() => useBoardPrefs(), { wrapper });

    await waitFor(() => {
      expect(result.current.boardColorId).toBe('green');
      expect(result.current.pieceSetId).toBe('chessnut');
    });
  });

  it('null ile temizlenince localStorage anahtarı silinir', async () => {
    const { result } = renderHook(() => useBoardPrefs(), { wrapper });
    await waitFor(() => expect(result.current.boardColorId).toBeNull());

    act(() => result.current.setBoardColorId('blue'));
    expect(localStorage.getItem('board-color-id')).toBe('blue');

    act(() => result.current.setBoardColorId(null));
    expect(result.current.boardColorId).toBeNull();
    expect(localStorage.getItem('board-color-id')).toBeNull();
  });
});
