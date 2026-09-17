'use client';
import { useEffect, useRef, useState } from 'react';
import {
  GAME_WIDTH, GAME_HEIGHT, GROUND_Y, TICK_MS,
  OBSTACLE_KINDS, OBSTACLE_SPECS, DRONE_Y, DRONE_TELEGRAPH_MS, FIREBALL_FALL_MS,
  HORSE_X,
  JUMP_DURATION_MS, speedAtScore, nextSpawnDelayMs, nextDroneDelayMs,
  horseRect, obstacleRect, fireballRect, jumpOffset, checkCollision,
  isDashing, handleRelease, resolvePendingTap, INITIAL_INPUT_STATE,
  loadHighScore, saveHighScore,
} from '@/lib/waitingGame';
import type { InputState, ObstacleKind, Rect } from '@/lib/waitingGame';

/**
 * Madde 2026-09-17 (Sporcu Ekranı, madde 6): antrenörün onayını beklerken
 * oynanan bekleme mini-oyunu — Chrome'un çevrimdışı dinozor oyunundan
 * ESİNLENDİ ama görseller BAĞIMSIZ (kendi lisanslı taş SVG'lerimiz, bkz.
 * public/pieces/LICENSES.md), Chrome'un sprite'ları hiç kullanılmadı.
 *
 * At üstünde Şah (wN+wK bindirilmiş), piyon/fil/kale engelleri (wP/wB/wR),
 * drone + ateş topu (orijinal, elle çizilmiş basit SVG). Kontrol: boşluk
 * KISA bas-bırak = zıplama (tek=küçük/piyon, çift=büyük/fil+kale), UZUN
 * basılı tutma = "dash" (hızlanıp ateş topunun sütunundan fiziksel çıkma —
 * "hızlanıp geç"). Aynı akış dokunma (ekran üstü buton) için de geçerli.
 *
 * Oyun döngüsü TEK bir `setInterval` (rAF/zincirlenmiş setTimeout DEĞİL) —
 * bu oturumda daha önce (Aday Hamle Pratiği) çıkarılan "setInterval,
 * vi.useFakeTimers() altında daha öngörülebilir" dersinin AYNISI. Skor
 * TAMAMEN yerel (localStorage) — hesaba/backend'e hiç gitmez (bkz.
 * lib/waitingGame.ts::loadHighScore/saveHighScore).
 */

interface Obstacle { id: number; kind: ObstacleKind; x: number }
type DronePhase = 'telegraph' | 'falling';
interface DroneShot { phase: DronePhase; elapsedMs: number }
interface Jump { kind: 1 | 2; elapsedMs: number }

interface GameState {
  score: number;
  obstacles: Obstacle[];
  drone: DroneShot | null;
  jump: Jump | null;
  dashing: boolean;
  gameOver: boolean;
  spawnRemainingMs: number;
  droneRemainingMs: number;
}

function initialGameState(): GameState {
  return {
    score: 0, obstacles: [], drone: null, jump: null, dashing: false, gameOver: false,
    spawnRemainingMs: nextSpawnDelayMs(speedAtScore(0), Math.random()),
    droneRemainingMs: nextDroneDelayMs(Math.random()),
  };
}

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function rectStyle(r: Rect) {
  return {
    left: pct(r.x, GAME_WIDTH), top: pct(r.y, GAME_HEIGHT),
    width: pct(r.width, GAME_WIDTH), height: pct(r.height, GAME_HEIGHT),
  };
}

const PIECE_SET = 'cburnett';
const obstacleImg: Record<ObstacleKind, string> = {
  piyon: `/pieces/${PIECE_SET}/wP.svg`, fil: `/pieces/${PIECE_SET}/wB.svg`, kale: `/pieces/${PIECE_SET}/wR.svg`,
};

function DroneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#334155" strokeWidth="2">
      <circle cx="12" cy="12" r="3" fill="#334155" />
      <path d="M4 4l4 4M20 4l-4 4M4 20l4-4M20 20l-4-4" strokeLinecap="round" />
      <circle cx="4" cy="4" r="2.2" /><circle cx="20" cy="4" r="2.2" />
      <circle cx="4" cy="20" r="2.2" /><circle cx="20" cy="20" r="2.2" />
    </svg>
  );
}

function FireballIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <circle cx="12" cy="12" r="9" fill="#f97316" />
      <circle cx="12" cy="12" r="5" fill="#facc15" />
    </svg>
  );
}

export function WaitingGame() {
  const [game, setGame] = useState<GameState>(initialGameState);
  const [highScore, setHighScore] = useState(0);
  const inputRef = useRef<InputState>(INITIAL_INPUT_STATE);
  const obstacleIdRef = useRef(0);

  useEffect(() => { setHighScore(loadHighScore()); }, []);

  useEffect(() => {
    if (!game.gameOver) return;
    const finalScore = Math.floor(game.score);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      saveHighScore(finalScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameOver]);

  useEffect(() => {
    const id = setInterval(() => {
      setGame((prev) => {
        if (prev.gameOver) return prev;
        const now = Date.now();

        const pending = resolvePendingTap(inputRef.current, now);
        inputRef.current = pending.next;
        const dashing = isDashing(inputRef.current, now);

        let jump = prev.jump;
        if (pending.jump && !jump) jump = { kind: pending.jump, elapsedMs: 0 };
        if (jump) {
          const elapsedMs = jump.elapsedMs + TICK_MS;
          jump = elapsedMs <= JUMP_DURATION_MS[jump.kind] ? { kind: jump.kind, elapsedMs } : null;
        }

        const speed = speedAtScore(prev.score);
        const score = prev.score + speed * (TICK_MS / 100);

        let obstacles = prev.obstacles
          .map((o) => ({ ...o, x: o.x - speed }))
          .filter((o) => o.x + OBSTACLE_SPECS[o.kind].width > -10);
        let spawnRemainingMs = prev.spawnRemainingMs - TICK_MS;
        if (spawnRemainingMs <= 0) {
          const kind = OBSTACLE_KINDS[Math.floor(Math.random() * OBSTACLE_KINDS.length)];
          obstacles = [...obstacles, { id: obstacleIdRef.current++, kind, x: GAME_WIDTH + 10 }];
          spawnRemainingMs = nextSpawnDelayMs(speed, Math.random());
        }

        let drone = prev.drone;
        let droneRemainingMs = prev.droneRemainingMs;
        if (!drone) {
          droneRemainingMs -= TICK_MS;
          if (droneRemainingMs <= 0) drone = { phase: 'telegraph', elapsedMs: 0 };
        } else {
          const elapsedMs = drone.elapsedMs + TICK_MS;
          if (drone.phase === 'telegraph') {
            drone = elapsedMs >= DRONE_TELEGRAPH_MS ? { phase: 'falling', elapsedMs: 0 } : { phase: 'telegraph', elapsedMs };
          } else if (elapsedMs >= FIREBALL_FALL_MS) {
            drone = null;
            droneRemainingMs = nextDroneDelayMs(Math.random());
          } else {
            drone = { phase: 'falling', elapsedMs };
          }
        }

        const hRect = horseRect(dashing, jumpOffset(jump?.kind ?? 1, jump?.elapsedMs ?? -1));
        let gameOver = obstacles.some((o) => checkCollision(hRect, obstacleRect(o.kind, o.x)));
        if (!gameOver && drone?.phase === 'falling') {
          gameOver = checkCollision(hRect, fireballRect(drone.elapsedMs));
        }

        return { score, obstacles, drone, jump, dashing, gameOver, spawnRemainingMs, droneRemainingMs };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  function pressStart() {
    if (inputRef.current.pressStartMs !== null) return;
    inputRef.current = { pressStartMs: Date.now(), pendingTapMs: inputRef.current.pendingTapMs };
  }

  function pressEnd() {
    const { next, jump: jumpKind } = handleRelease(inputRef.current, Date.now());
    inputRef.current = next;
    if (jumpKind) {
      setGame((g) => (g.jump || g.gameOver ? g : { ...g, jump: { kind: jumpKind, elapsedMs: 0 } }));
    }
  }

  function restart() {
    inputRef.current = INITIAL_INPUT_STATE;
    obstacleIdRef.current = 0;
    setGame(initialGameState());
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      e.preventDefault();
      if (!game.gameOver) pressStart();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      e.preventDefault();
      pressEnd();
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.gameOver]);

  const hRect = horseRect(game.dashing, jumpOffset(game.jump?.kind ?? 1, game.jump?.elapsedMs ?? -1));

  return (
    <div className="t-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">Antrenörünü beklerken oyna</p>
        <p className="text-xs font-mono t-muted" data-testid="score">
          HI {String(highScore).padStart(5, '0')} {String(Math.floor(game.score)).padStart(5, '0')}
        </p>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg select-none"
        style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}`, background: 'var(--t-surface-2)' }}>
        {/* Zemin çizgisi */}
        <div className="absolute left-0 right-0" style={{ top: pct(GROUND_Y, GAME_HEIGHT), borderTop: '2px solid var(--t-border)' }} />

        {/* At + Şah */}
        <div className="absolute" data-testid="horse" data-dashing={game.dashing}
          data-jumping={game.jump ? game.jump.kind : undefined} style={rectStyle(hRect)}>
          <img src={`/pieces/${PIECE_SET}/wN.svg`} alt="" className="absolute inset-0 w-full h-full" />
          <img src={`/pieces/${PIECE_SET}/wK.svg`} alt=""
            className="absolute" style={{ width: '55%', height: '55%', top: '-30%', right: '-8%' }} />
        </div>

        {/* Engeller */}
        {game.obstacles.map((o) => (
          <img key={o.id} src={obstacleImg[o.kind]} alt="" className="absolute"
            style={rectStyle(obstacleRect(o.kind, o.x))} />
        ))}

        {/* Drone + ateş topu */}
        {game.drone && (
          <div className="absolute" style={{
            left: pct(HORSE_X - 5, GAME_WIDTH), top: pct(DRONE_Y, GAME_HEIGHT),
            width: pct(26, GAME_WIDTH), height: pct(26, GAME_HEIGHT),
            opacity: game.drone.phase === 'telegraph' && Math.floor(game.drone.elapsedMs / 90) % 2 === 0 ? 0.35 : 1,
          }}>
            <DroneIcon />
          </div>
        )}
        {game.drone?.phase === 'falling' && (
          <div className="absolute" style={rectStyle(fireballRect(game.drone.elapsedMs))}>
            <FireballIcon />
          </div>
        )}

        {game.gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            <p className="text-sm font-bold" style={{ color: '#fff' }}>Oyun Bitti</p>
            <p className="text-xs" style={{ color: '#fff' }}>
              Skor: {Math.floor(game.score)} · En Yüksek: {highScore}
            </p>
            <button type="button" onClick={restart}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
              Tekrar Oyna
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); if (!game.gameOver) pressStart(); }}
        onPointerUp={(e) => { e.preventDefault(); pressEnd(); }}
        onPointerLeave={() => { if (inputRef.current.pressStartMs !== null) pressEnd(); }}
        className="w-full rounded-lg px-3 py-2.5 text-xs font-bold"
        style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }}>
        Basılı tut: hızlan · Dokun: zıpla (çift dokun: yüksek zıpla)
      </button>
      <p className="text-[11px] t-muted text-center hidden sm:block">
        Bilgisayarda boşluk tuşu da kullanılabilir.
      </p>
    </div>
  );
}
