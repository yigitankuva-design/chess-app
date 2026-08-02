import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';

const FENS = ['f0', 'f1', 'f2', 'f3'];

describe('useMoveHistoryNav — geçmişte gezinme (madde 1)', () => {
  it('başlangıçta CANLI konumu gösterir', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f3');
    expect(result.current.viewIndex).toBe(3);
  });

  it('bir adım geri gidince canlıdan çıkar', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.step(-1));
    expect(result.current.isLive).toBe(false);
    expect(result.current.viewFen).toBe('f2');
  });

  it('goTo ile belirli bir hamleye atlar', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(1));
    expect(result.current.viewFen).toBe('f1');
  });

  it('goLive canlı konuma döndürür', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(0));
    expect(result.current.isLive).toBe(false);
    act(() => result.current.goLive());
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f3');
  });

  it('başlangıcın gerisine gidilemez', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(0));
    act(() => result.current.step(-1));
    expect(result.current.viewIndex).toBe(0);
  });

  it('son konumun ilerisine adım atınca CANLIYA döner', () => {
    const { result } = renderHook(() => useMoveHistoryNav(FENS));
    act(() => result.current.goTo(2));
    act(() => result.current.step(1));
    expect(result.current.isLive).toBe(true);
  });

  it('KARAR: geçmişe bakarken yeni hamle gelirse tahta GEÇMİŞTE KALIR', () => {
    // Kullanici bunu acikca secti: rakip hamle yapinca ekran zorla
    // canliya SICRAMAZ; sporcu kendisi doner.
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    act(() => result.current.goTo(1));
    rerender({ fens: [...FENS, 'f4'] });
    expect(result.current.viewFen).toBe('f1');
    expect(result.current.isLive).toBe(false);
  });

  it('canlıyken yeni hamle gelirse canlı kalmaya devam eder', () => {
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    rerender({ fens: [...FENS, 'f4'] });
    expect(result.current.isLive).toBe(true);
    expect(result.current.viewFen).toBe('f4');
  });

  it('TUZAK: liste kısalırsa taşan sıra sınıra çekilir, ekran kilitlenmez', () => {
    const { result, rerender } = renderHook(
      ({ fens }) => useMoveHistoryNav(fens),
      { initialProps: { fens: FENS } },
    );
    act(() => result.current.goTo(3));
    rerender({ fens: ['f0', 'f1'] });
    expect(result.current.viewFen).toBe('f1');
  });

  it('boş listede çökmez', () => {
    const { result } = renderHook(() => useMoveHistoryNav([]));
    expect(result.current.viewFen).toBeUndefined();
    expect(result.current.isLive).toBe(true);
  });
});
