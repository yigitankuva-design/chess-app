import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WaitingGame } from '@/components/WaitingGame';
import { TAP_MAX_MS, DOUBLE_TAP_WINDOW_MS, TICK_MS, JUMP_DURATION_MS, HIGH_SCORE_KEY } from '@/lib/waitingGame';

/** Madde 2026-09-17 (Sporcu Ekranı, madde 6): bileşenin gerçek
 *  çarpışma→"Oyun Bitti" akışı rastgele engel-doğuşuna bağlı olduğu için
 *  (deterministik tetiklemek için test-özel bir kanca eklemek istemedim)
 *  bu TEST DOSYASI sadece girdi kablolaması (tap/çift-tap/hold → zıplama/
 *  dash) ve yüksek skor okuma/gösterimini doğruluyor — alttaki saf mantık
 *  (çarpışma, zıplama fiziği, ateş topu sütunu) tests/waiting-game-logic.
 *  test.ts'te ZATEN kapsamlı test edildi. Established desen (Aday Hamle
 *  Pratiği, Faz A): `setInterval` tabanlı döngüler `vi.useFakeTimers()`
 *  altında `act()` ile ilerletilir. */

function spaceDown() { fireEvent.keyDown(window, { code: 'Space' }); }
function spaceUp() { fireEvent.keyUp(window, { code: 'Space' }); }

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('başlangıçta skor 00000, at ve dokunma butonu görünür', () => {
  render(<WaitingGame />);
  expect(screen.getByTestId('score')).toHaveTextContent('HI 00000 00000');
  expect(screen.getByTestId('horse')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Basılı tut/ })).toBeInTheDocument();
});

it('mount olurken localStorage\'daki yüksek skoru okur ve gösterir', () => {
  localStorage.setItem(HIGH_SCORE_KEY, '77');
  render(<WaitingGame />);
  expect(screen.getByTestId('score')).toHaveTextContent('HI 00077');
});

it('zaman geçtikçe skor artar', () => {
  render(<WaitingGame />);
  act(() => { vi.advanceTimersByTime(1000); });
  expect(screen.getByTestId('score')).not.toHaveTextContent('HI 00000 00000');
});

it('boşluk KISA basılıp bırakılınca (tek dokunuş) bekleme penceresi dolunca küçük zıplama tetiklenir, süresi bitince biter', () => {
  render(<WaitingGame />);
  spaceDown();
  act(() => { vi.advanceTimersByTime(50); });
  spaceUp();

  act(() => { vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS + TICK_MS * 2); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-jumping', '1');

  act(() => { vi.advanceTimersByTime(JUMP_DURATION_MS[1] + TICK_MS * 2); });
  expect(screen.getByTestId('horse')).not.toHaveAttribute('data-jumping');
});

it('boşluk pencere içinde İKİ kez kısa basılıp bırakılınca ANINDA büyük zıplama tetiklenir', () => {
  render(<WaitingGame />);
  spaceDown();
  act(() => { vi.advanceTimersByTime(40); });
  spaceUp();
  act(() => { vi.advanceTimersByTime(60); });
  spaceDown();
  act(() => { vi.advanceTimersByTime(40); });
  spaceUp();
  act(() => { vi.advanceTimersByTime(TICK_MS); });

  expect(screen.getByTestId('horse')).toHaveAttribute('data-jumping', '2');
});

it('boşluk UZUN basılı tutulunca dash aktif olur, bırakınca kapanır', () => {
  render(<WaitingGame />);
  spaceDown();
  act(() => { vi.advanceTimersByTime(TAP_MAX_MS + TICK_MS); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-dashing', 'true');

  spaceUp();
  act(() => { vi.advanceTimersByTime(TICK_MS); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-dashing', 'false');
});

it('dash SIRASINDA zıplama tetiklenmez (basılı tutmanın bırakılması zıplama saymaz)', () => {
  render(<WaitingGame />);
  spaceDown();
  act(() => { vi.advanceTimersByTime(TAP_MAX_MS + 300); }); // uzun süre dash'te kal
  spaceUp();
  act(() => { vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS + TICK_MS * 2); });
  expect(screen.getByTestId('horse')).not.toHaveAttribute('data-jumping');
});

it('dokunma butonu (mobil) pointerdown/pointerup ile kısa basış — klavyeyle AYNI mantığı kullanır', () => {
  render(<WaitingGame />);
  const btn = screen.getByRole('button', { name: /Basılı tut/ });
  fireEvent.pointerDown(btn);
  act(() => { vi.advanceTimersByTime(40); });
  fireEvent.pointerUp(btn);
  act(() => { vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS + TICK_MS * 2); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-jumping', '1');
});

it('parmak kaydırılıp ekrandan çıkarsa (pointerLeave) da basış bırakılmış sayılır', () => {
  render(<WaitingGame />);
  const btn = screen.getByRole('button', { name: /Basılı tut/ });
  fireEvent.pointerDown(btn);
  act(() => { vi.advanceTimersByTime(TAP_MAX_MS + TICK_MS); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-dashing', 'true');

  fireEvent.pointerLeave(btn);
  act(() => { vi.advanceTimersByTime(TICK_MS); });
  expect(screen.getByTestId('horse')).toHaveAttribute('data-dashing', 'false');
});
