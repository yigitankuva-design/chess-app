/**
 * Madde 2026-09-17 (Sporcu Ekranı, madde 6 — bekleme mini-oyunu): antrenörün
 * onayını beklerken oynanan, Chrome'un çevrimdışı dinozor oyunundan
 * ESİNLENEN ama görselleri BAĞIMSIZ (kendi lisanslı taş SVG'lerimiz) satranç
 * temalı bir "engelden kaç" oyunu — At üstünde Şah, piyon/fil/kale
 * engelleri, drone + ateş topu.
 *
 * Bu dosya SAF (React/DOM/timer'dan bağımsız) oyun mantığını taşır —
 * `components/WaitingGame.tsx` sadece bunu bir `setInterval` döngüsüyle
 * çağırıp render eder. Madde: zamanlama fonksiyonları `Date.now()`'u
 * KENDİLERİ çağırmaz, `now` parametre olarak verilir — bu sayede timer/DOM
 * hiç gerekmeden, düz sayılarla test edilebilir.
 */

export interface Rect { x: number; y: number; width: number; height: number }

// ── Oyun alanı boyutları (oyun birimi = CSS px, bileşen bunu ölçeklendirir) ──
export const GAME_WIDTH = 340;
export const GAME_HEIGHT = 140;
export const GROUND_Y = 110;

export const HORSE_X = 40;
export const HORSE_WIDTH = 46;
export const HORSE_HEIGHT = 46;
/** Boşluk basılı tutulunca (dash) at'ın X'ine eklenen kayma — drone'un
 *  ateş topu sütunundan (HORSE_X) fiziksel olarak çıkarır ("hızlanıp geç"). */
export const DASH_OFFSET = 55;

// ── Girdi zamanlama eşikleri ──
export const TICK_MS = 30;
/** Bundan KISA bas-bırak = zıplama tap'ı; bundan UZUN basılı tutma = dash. */
export const TAP_MAX_MS = 220;
/** İkinci tap bu pencere içinde gelirse çift-tap (büyük zıplama) sayılır. */
export const DOUBLE_TAP_WINDOW_MS = 300;

export interface InputState {
  /** Şu an basılı mı, ne zaman başladı — basılı değilse null. */
  pressStartMs: number | null;
  /** Kısa bir bas-bırak oldu ama ikinci basışın gelip gelmeyeceği henüz
   *  belirsiz — o bırakışın zamanı (pencere dolunca tek zıplama sayılır). */
  pendingTapMs: number | null;
}

export const INITIAL_INPUT_STATE: InputState = { pressStartMs: null, pendingTapMs: null };

/** Şu an TAP_MAX_MS'i aşacak kadar basılı tutuluyorsa "dash" aktiftir. */
export function isDashing(state: InputState, now: number): boolean {
  return state.pressStartMs !== null && now - state.pressStartMs >= TAP_MAX_MS;
}

/** Basış BIRAKILDIĞINDA çağrılır (klavye keyup / dokunma pointerup — İKİSİ
 *  DE aynı fonksiyonu kullanır). Uzun basıştan (dash) sonra bırakma ASLA
 *  zıplama saymaz. Kısaysa: bekleyen bir tek-tap VARSA ve pencerede ise
 *  çift zıplama tetikler; yoksa yeni bir "bekleyen tek tap" başlatır (o da
 *  `resolvePendingTap` ile pencere dolunca tek zıplamaya döner). */
export function handleRelease(state: InputState, now: number): { next: InputState; jump: 1 | 2 | null } {
  if (state.pressStartMs === null) return { next: state, jump: null };
  const pressDuration = now - state.pressStartMs;
  if (pressDuration >= TAP_MAX_MS) {
    return { next: { pressStartMs: null, pendingTapMs: null }, jump: null };
  }
  if (state.pendingTapMs !== null && now - state.pendingTapMs <= DOUBLE_TAP_WINDOW_MS) {
    return { next: { pressStartMs: null, pendingTapMs: null }, jump: 2 };
  }
  return { next: { pressStartMs: null, pendingTapMs: now }, jump: null };
}

/** Bekleyen tek-tap'ın penceresi dolduysa (ikincisi gelmediyse) tek
 *  zıplamayı tetikler — bileşenin tick döngüsü her adımda çağırır. */
export function resolvePendingTap(state: InputState, now: number): { next: InputState; jump: 1 | null } {
  if (state.pendingTapMs !== null && now - state.pendingTapMs > DOUBLE_TAP_WINDOW_MS) {
    return { next: { ...state, pendingTapMs: null }, jump: 1 };
  }
  return { next: state, jump: null };
}

// ── Zıplama fiziği ──
export const JUMP_DURATION_MS: Record<1 | 2, number> = { 1: 420, 2: 620 };
/** Piyon (yükseklik 30) TEK zıplamayla (34), fil/kale (yükseklik 52) ise
 *  SADECE çift zıplamayla (62) aşılabilir — madde: tek zıplama fil/kaleyi
 *  AŞMAZ (bilerek). */
export const JUMP_HEIGHT: Record<1 | 2, number> = { 1: 34, 2: 62 };

/** t=0 ve t=süre'de 0, t=süre/2'de tepe noktası olan basit bir parabol. */
export function jumpOffset(kind: 1 | 2, elapsedMs: number): number {
  const duration = JUMP_DURATION_MS[kind];
  if (elapsedMs < 0 || elapsedMs > duration) return 0;
  const t = elapsedMs / duration;
  return JUMP_HEIGHT[kind] * 4 * t * (1 - t);
}

export function horseRect(dashing: boolean, jumpY: number): Rect {
  return {
    x: dashing ? HORSE_X + DASH_OFFSET : HORSE_X,
    y: GROUND_Y - HORSE_HEIGHT - jumpY,
    width: HORSE_WIDTH,
    height: HORSE_HEIGHT,
  };
}

// ── Engeller ──
export type ObstacleKind = 'piyon' | 'fil' | 'kale';
export const OBSTACLE_KINDS: ObstacleKind[] = ['piyon', 'fil', 'kale'];
export const OBSTACLE_SPECS: Record<ObstacleKind, { width: number; height: number }> = {
  piyon: { width: 22, height: 30 },
  fil: { width: 24, height: 52 },
  kale: { width: 26, height: 52 },
};

export function obstacleRect(kind: ObstacleKind, x: number): Rect {
  const spec = OBSTACLE_SPECS[kind];
  return { x, y: GROUND_Y - spec.height, width: spec.width, height: spec.height };
}

// ── Hız/zorluk eğrisi ──
export const BASE_SPEED = 2.2;
export const MAX_SPEED = 5.5;
export const SPEED_RAMP_PER_POINT = 0.01;

export function speedAtScore(score: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_RAMP_PER_POINT);
}

export const MIN_SPAWN_MS = 900;
export const MAX_SPAWN_MS = 1900;

/** `rand` [0,1) aralığında dışarıdan verilir (Math.random()) — saf/test
 *  edilebilir kalsın diye. Hızlandıkça engeller biraz sıklaşır. */
export function nextSpawnDelayMs(speed: number, rand: number): number {
  const span = MAX_SPAWN_MS - MIN_SPAWN_MS;
  const speedFactor = Math.min(1, Math.max(0, (speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)));
  const max = MAX_SPAWN_MS - speedFactor * span * 0.4;
  return MIN_SPAWN_MS + rand * (max - MIN_SPAWN_MS);
}

export const MIN_DRONE_MS = 6000;
export const MAX_DRONE_MS = 12000;

export function nextDroneDelayMs(rand: number): number {
  return MIN_DRONE_MS + rand * (MAX_DRONE_MS - MIN_DRONE_MS);
}

// ── Drone + ateş topu ──
export const DRONE_Y = 15;
export const DRONE_TELEGRAPH_MS = 550;
export const FIREBALL_FALL_MS = 500;
export const FIREBALL_WIDTH = 16;
export const FIREBALL_HEIGHT = 16;

/** Ateş topu HORSE_X sütununa "kilitlenir" (madde: at dash yapmazsa orada
 *  durur) — telegraf bitince düşmeye başlar, DRONE_Y'den GROUND_Y'ye. */
export function fireballY(elapsedFallMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedFallMs / FIREBALL_FALL_MS));
  return DRONE_Y + t * (GROUND_Y - DRONE_Y - FIREBALL_HEIGHT);
}

export function fireballRect(elapsedFallMs: number): Rect {
  return { x: HORSE_X, y: fireballY(elapsedFallMs), width: FIREBALL_WIDTH, height: FIREBALL_HEIGHT };
}

// ── Çarpışma ──
export function checkCollision(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// ── Yüksek skor (localStorage, hesaba/backend'e HİÇ gitmez) ──
export const HIGH_SCORE_KEY = 'canli-ders-bekleme-oyunu-yuksek-skor';

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0; // SSR / localStorage kapalı
  }
}

export function saveHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
  } catch {
    // ignore
  }
}
