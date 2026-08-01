import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSquareAnnotations } from '@/lib/chess/useSquareAnnotations';

/** Ctrl/Alt tuşlarını BASILI TUTAR (sağ tık ayrı çağrılır). Hook bu durumu
 *  window keydown/keyup ile takip ediyor. */
function holdModifiers(mods: { ctrlKey?: boolean; altKey?: boolean } = {}) {
  if (mods.ctrlKey) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
  if (mods.altKey) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
}

function releaseModifiers() {
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
}

describe('useSquareAnnotations', () => {
  afterEach(() => releaseModifiers());

  it('sade sağ-tık kareyi yeşil yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
  });

  it('Ctrl+sağ-tık kareyi kırmızı yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });

  it('Alt+sağ-tık kareyi mavi yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ altKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(96, 165, 250, 0.55)');
  });

  it('Ctrl+Alt+sağ-tık kareyi sarı yapar', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    holdModifiers({ ctrlKey: true, altKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(250, 204, 21, 0.55)');
  });

  it('aynı kareye aynı renkle tekrar sağ-tık işareti temizler (toggle)', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeDefined();
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeUndefined();
  });

  it('farklı renkle tekrar sağ-tık üzerine yazar (temizlemez)', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' })); // yeşil
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'e4' })); // kırmızı
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });

  it('resetKey değişince tüm işaretler temizlenir', () => {
    const { result, rerender } = renderHook(
      ({ key }) => useSquareAnnotations(key),
      { initialProps: { key: 'r1' } },
    );
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeDefined();
    rerender({ key: 'r2' });
    expect(result.current.squareStyles.e4).toBeUndefined();
  });

  it('birden fazla kare bağımsız işaretlenebilir', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    holdModifiers({ ctrlKey: true });
    act(() => result.current.onSquareRightClick({ square: 'd5' }));
    expect(result.current.squareStyles.e4?.backgroundColor).toBe('rgba(74, 222, 128, 0.55)');
    expect(result.current.squareStyles.d5?.backgroundColor).toBe('rgba(248, 113, 113, 0.55)');
  });
});

describe('clearAnnotations (madde 1)', () => {
  it('işaretleri boşaltır', () => {
    const { result } = renderHook(() => useSquareAnnotations('r1'));
    act(() => result.current.onSquareRightClick({ square: 'e4' }));
    expect(result.current.squareStyles.e4).toBeTruthy();
    act(() => result.current.clearAnnotations());
    expect(result.current.squareStyles.e4).toBeUndefined();
  });
});
