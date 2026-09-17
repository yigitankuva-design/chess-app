import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isDashing, handleRelease, resolvePendingTap, INITIAL_INPUT_STATE,
  TAP_MAX_MS, DOUBLE_TAP_WINDOW_MS,
  jumpOffset, JUMP_DURATION_MS, JUMP_HEIGHT,
  horseRect, obstacleRect, fireballRect, checkCollision,
  speedAtScore, BASE_SPEED, MAX_SPEED,
  nextSpawnDelayMs, MIN_SPAWN_MS, MAX_SPAWN_MS,
  nextDroneDelayMs, MIN_DRONE_MS, MAX_DRONE_MS,
  fireballY, DRONE_Y, GROUND_Y, HORSE_X, DASH_OFFSET, FIREBALL_FALL_MS,
  loadHighScore, saveHighScore, HIGH_SCORE_KEY,
} from '@/lib/waitingGame';
import type { InputState } from '@/lib/waitingGame';

// Madde 2026-09-17 (Sporcu Ekranı, madde 6 — bekleme mini-oyunu): SAF oyun
// mantığı — hiçbir timer/DOM gerektirmez, tüm zamanlama `now` parametresiyle
// verilir (bkz. lib/waitingGame.ts başlığı).

describe('girdi sınıflandırma — isDashing/handleRelease/resolvePendingTap', () => {
  it('basılı değilken dash aktif değildir', () => {
    expect(isDashing(INITIAL_INPUT_STATE, 1000)).toBe(false);
  });

  it('TAP_MAX_MS altında basılıyken dash aktif DEĞİL, üstünde AKTİF', () => {
    const pressed: InputState = { pressStartMs: 1000, pendingTapMs: null };
    expect(isDashing(pressed, 1000 + TAP_MAX_MS - 1)).toBe(false);
    expect(isDashing(pressed, 1000 + TAP_MAX_MS)).toBe(true);
  });

  it('kısa bas-bırak (tek) ANINDA zıplama tetiklemez, "bekleyen tap" başlatır', () => {
    const pressed: InputState = { pressStartMs: 1000, pendingTapMs: null };
    const { next, jump } = handleRelease(pressed, 1000 + 100); // TAP_MAX_MS altı
    expect(jump).toBeNull();
    expect(next.pendingTapMs).toBe(1100);
    expect(next.pressStartMs).toBeNull();
  });

  it('bekleyen tap penceresi dolunca resolvePendingTap TEK zıplama döner', () => {
    const withPending: InputState = { pressStartMs: null, pendingTapMs: 1000 };
    const notYet = resolvePendingTap(withPending, 1000 + DOUBLE_TAP_WINDOW_MS);
    expect(notYet.jump).toBeNull(); // tam pencerede — henüz dolmadı (> şart)
    const expired = resolvePendingTap(withPending, 1000 + DOUBLE_TAP_WINDOW_MS + 1);
    expect(expired.jump).toBe(1);
    expect(expired.next.pendingTapMs).toBeNull();
  });

  it('pencere içinde İKİNCİ kısa bas-bırak ÇİFT zıplama tetikler', () => {
    const afterFirstTap: InputState = { pressStartMs: null, pendingTapMs: 1000 };
    const secondPress: InputState = { pressStartMs: 1150, pendingTapMs: afterFirstTap.pendingTapMs };
    const { next, jump } = handleRelease(secondPress, 1150 + 50); // kısa ikinci bas-bırak
    expect(jump).toBe(2);
    expect(next).toEqual({ pressStartMs: null, pendingTapMs: null });
  });

  it('UZUN basıştan (dash) sonra bırakma HİÇBİR zıplama tetiklemez', () => {
    const pressed: InputState = { pressStartMs: 1000, pendingTapMs: null };
    const { next, jump } = handleRelease(pressed, 1000 + TAP_MAX_MS + 500);
    expect(jump).toBeNull();
    expect(next).toEqual({ pressStartMs: null, pendingTapMs: null });
  });

  it('basılı değilken handleRelease çağrılırsa (no-op) state değişmez', () => {
    const { next, jump } = handleRelease(INITIAL_INPUT_STATE, 5000);
    expect(jump).toBeNull();
    expect(next).toBe(INITIAL_INPUT_STATE);
  });
});

describe('zıplama fiziği — jumpOffset', () => {
  it('başlangıçta ve bitişte yükseklik 0, ortada tepe noktası', () => {
    expect(jumpOffset(1, 0)).toBe(0);
    expect(jumpOffset(1, JUMP_DURATION_MS[1])).toBe(0);
    expect(jumpOffset(1, JUMP_DURATION_MS[1] / 2)).toBeCloseTo(JUMP_HEIGHT[1], 5);
  });

  it('süre dışındaki elapsedMs için 0 döner', () => {
    expect(jumpOffset(2, -5)).toBe(0);
    expect(jumpOffset(2, JUMP_DURATION_MS[2] + 5)).toBe(0);
  });

  it('büyük zıplama (2) küçükten (1) daha yüksektir — fil/kale ancak büyükle aşılabilir', () => {
    expect(JUMP_HEIGHT[2]).toBeGreaterThan(JUMP_HEIGHT[1]);
  });
});

describe('dikdörtgenler ve çarpışma', () => {
  it('horseRect: dash aktifken X, DASH_OFFSET kadar sağa kayar', () => {
    const normal = horseRect(false, 0);
    const dashed = horseRect(true, 0);
    expect(dashed.x - normal.x).toBe(DASH_OFFSET);
    expect(normal.x).toBe(HORSE_X);
  });

  it('horseRect: zıplama yüksekliği arttıkça Y küçülür (yukarı çıkar)', () => {
    const grounded = horseRect(false, 0);
    const jumping = horseRect(false, 30);
    expect(jumping.y).toBeLessThan(grounded.y);
  });

  it('obstacleRect: engel tabanı GROUND_Y\'ye oturur', () => {
    const r = obstacleRect('piyon', 200);
    expect(r.y + r.height).toBe(GROUND_Y);
    expect(r.x).toBe(200);
  });

  it('checkCollision: çakışan/çakışmayan dikdörtgenleri doğru ayırt eder', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(checkCollision(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(checkCollision(a, { x: 20, y: 0, width: 10, height: 10 })).toBe(false);
    expect(checkCollision(a, { x: 0, y: 20, width: 10, height: 10 })).toBe(false);
    // Tam bitişik (dokunan ama örtüşmeyen) kenarlar çarpışma SAYILMAZ.
    expect(checkCollision(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it('at zıplarken ALÇAK (piyon) engelle çakışmaz, ama YÜKSEK zıplamadan önce YERDEYKEN çakışır', () => {
    const obstacle = obstacleRect('piyon', HORSE_X); // tam üst üste X
    const grounded = horseRect(false, 0);
    expect(checkCollision(grounded, obstacle)).toBe(true);
    const midJump = horseRect(false, jumpOffset(1, JUMP_DURATION_MS[1] / 2));
    expect(checkCollision(midJump, obstacle)).toBe(false);
  });

  it('fil/kale engelini SADECE büyük (2) zıplama aşar, küçük (1) aşamaz', () => {
    const obstacle = obstacleRect('fil', HORSE_X);
    const smallJumpPeak = horseRect(false, jumpOffset(1, JUMP_DURATION_MS[1] / 2));
    const bigJumpPeak = horseRect(false, jumpOffset(2, JUMP_DURATION_MS[2] / 2));
    expect(checkCollision(smallJumpPeak, obstacle)).toBe(true);
    expect(checkCollision(bigJumpPeak, obstacle)).toBe(false);
  });

  it('fireballRect: HER ZAMAN HORSE_X sütununa kilitli', () => {
    expect(fireballRect(0).x).toBe(HORSE_X);
    expect(fireballRect(250).x).toBe(HORSE_X);
    expect(fireballRect(500).x).toBe(HORSE_X);
  });

  it('yere yakın ateş topu, yerdeki atla çarpışır ama DASH ile o sütundan çıkılınca çarpışmaz ("hızlanıp geç")', () => {
    const groundedHorse = horseRect(false, 0);
    const dashedHorse = horseRect(true, 0);
    const lowFall = fireballRect(FIREBALL_FALL_MS); // düşüş tamamlandı, yere yakın
    expect(checkCollision(groundedHorse, lowFall)).toBe(true);
    expect(checkCollision(dashedHorse, lowFall)).toBe(false);
  });

  it('fireballY: düşüş başında drone yüksekliğinde, süre dolunca yere yakın konumda sabitlenir (clamp)', () => {
    expect(fireballY(0)).toBe(DRONE_Y);
    expect(fireballY(10000)).toBe(fireballY(FIREBALL_FALL_MS)); // FIREBALL_FALL_MS sonrası clamp
    expect(fireballY(10000)).toBeGreaterThan(fireballY(0));
  });
});

describe('hız/zorluk eğrisi', () => {
  it('skor arttıkça hız artar, MAX_SPEED\'i geçmez', () => {
    expect(speedAtScore(0)).toBe(BASE_SPEED);
    expect(speedAtScore(100)).toBeGreaterThan(BASE_SPEED);
    expect(speedAtScore(1_000_000)).toBe(MAX_SPEED);
  });

  it('nextSpawnDelayMs/nextDroneDelayMs sınırlar içinde kalır (rand=0 ve rand tam altında)', () => {
    expect(nextSpawnDelayMs(BASE_SPEED, 0)).toBe(MIN_SPAWN_MS);
    expect(nextSpawnDelayMs(BASE_SPEED, 0.999)).toBeLessThan(MAX_SPAWN_MS);
    expect(nextDroneDelayMs(0)).toBe(MIN_DRONE_MS);
    expect(nextDroneDelayMs(0.999)).toBeLessThan(MAX_DRONE_MS);
  });

  it('hız arttıkça spawn aralığının ÜST sınırı biraz daralır (daha sık engel)', () => {
    const lowSpeedMax = nextSpawnDelayMs(BASE_SPEED, 1);
    const highSpeedMax = nextSpawnDelayMs(MAX_SPEED, 1);
    expect(highSpeedMax).toBeLessThan(lowSpeedMax);
  });
});

describe('yüksek skor — localStorage (madde 3: hesaba/backend\'e HİÇ gitmez)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('hiç kayıt yokken 0 döner', () => {
    expect(loadHighScore()).toBe(0);
  });

  it('kaydedilen skor doğru okunur, tamsayıya yuvarlanır', () => {
    saveHighScore(123.7);
    expect(localStorage.getItem(HIGH_SCORE_KEY)).toBe('123');
    expect(loadHighScore()).toBe(123);
  });

  it('bozuk/negatif veri güvenle 0\'a düşer', () => {
    localStorage.setItem(HIGH_SCORE_KEY, 'not-a-number');
    expect(loadHighScore()).toBe(0);
    localStorage.setItem(HIGH_SCORE_KEY, '-5');
    expect(loadHighScore()).toBe(0);
  });

  it('localStorage erişilemezse (ör. gizli sekme) sessizce 0 döner/hata fırlatmaz', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => loadHighScore()).not.toThrow();
    expect(loadHighScore()).toBe(0);
    spy.mockRestore();
  });
});
