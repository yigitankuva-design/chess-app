'use client';
/**
 * Piece sound effects for board exercises.
 *
 * Two layers:
 *  1. Real recordings — if a matching file exists in /public/sounds/ it is used
 *     automatically (probed once with a silent HEAD request, no 404 console spam).
 *  2. Synthesis fallback — Web Audio API synthesises an evocative sound per piece
 *     so it works with zero assets. Knight (At) = horse whinny, Bishop (Fil) =
 *     elephant trumpet, Rook (Kale) = stone thud, Queen (Vezir) = bell chime,
 *     King (Şah) = regal horn, Pawn (Piyon) = soft wood tap.
 *
 * pieceType comes from react-chessboard as "wN" / "bN" etc; we use the last
 * letter (N, B, R, Q, K, P) so colour doesn't matter.
 */

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ── Real recordings (auto-used if present) ───────────────────────────────────
// Knight = real horse neigh (public domain), Bishop = real elephant trumpet
// (CC0), both from Wikimedia Commons. Other pieces use synthesis below. To add
// real recordings for them, drop e.g. /sounds/rook.mp3 here.
const FILES: Record<string, string> = {
  N: '/sounds/knight.mp3',  // 🐴 At  — gerçek at kişnemesi (Wiehern.ogg, PD)
  B: '/sounds/bishop.mp3',  // 🐘 Fil — gerçek fil borusu (Elephant trumpeting, CC0)
};
const audioEl: Record<string, HTMLAudioElement> = {};
const fileReady: Record<string, boolean> = {};
const probing: Record<string, boolean> = {};

function probe(letter: string) {
  if (letter in fileReady || probing[letter]) return;
  const url = FILES[letter];
  if (!url) return;
  probing[letter] = true;
  fetch(url, { method: 'HEAD' })
    .then((res) => {
      if (res.ok) {
        const a = new Audio(url);
        a.preload = 'auto';
        audioEl[letter] = a;
        fileReady[letter] = true;
      } else {
        fileReady[letter] = false;
      }
    })
    .catch(() => { fileReady[letter] = false; });
}

function playFile(letter: string): boolean {
  if (!fileReady[letter]) return false;
  const a = audioEl[letter];
  if (!a) return false;
  try { a.currentTime = 0; void a.play(); return true; } catch { return false; }
}

// ── Synthesis ─────────────────────────────────────────────────────────────────

/** Knight = horse whinny: descending sawtooth with fast vibrato + amplitude flutter. */
function horse(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 0.85;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, t0);
  osc.frequency.exponentialRampToValueAtTime(170, t0 + dur);

  // vibrato — gives the warbling "i-hi-hi" texture
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(30, t0);
  lfo.frequency.linearRampToValueAtTime(18, t0 + dur);
  const lfoGain = c.createGain();
  lfoGain.gain.setValueAtTime(55, t0);
  lfo.connect(lfoGain).connect(osc.frequency);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
  // staccato flutter of the neigh
  for (let i = 0; i < 6; i++) {
    const tt = t0 + 0.12 + i * 0.11;
    amp.gain.exponentialRampToValueAtTime(0.18, tt);
    amp.gain.exponentialRampToValueAtTime(0.45, tt + 0.05);
  }
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(lp).connect(amp).connect(c.destination);
  osc.start(t0); lfo.start(t0);
  osc.stop(t0 + dur); lfo.stop(t0 + dur);
}

/** Bishop (Fil = elephant) = trumpet: brassy pitch sweep up then down through a bandpass. */
function elephant(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 0.9;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(680, t0 + 0.22);
  osc.frequency.setValueAtTime(680, t0 + 0.5);
  osc.frequency.exponentialRampToValueAtTime(230, t0 + dur);

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 2.5;

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(0.55, t0 + 0.08);
  amp.gain.setValueAtTime(0.5, t0 + 0.5);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(bp).connect(amp).connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur);
}

/** Rook (Kale) = heavy stone thud: filtered noise burst. */
function thud(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 0.28;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(420, t0);
  lp.frequency.exponentialRampToValueAtTime(120, t0 + dur);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.7, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(lp).connect(amp).connect(c.destination);
  src.start(t0); src.stop(t0 + dur);
}

/** Queen (Vezir) = bright bell chime: stacked sine partials with bell decay. */
function chime(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 1.0;
  [880, 1320, 1760].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32 / (i + 1), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur);
  });
}

/** King (Şah) = regal two-note horn fanfare. */
function horn(c: AudioContext) {
  const t0 = c.currentTime;
  const notes: [number, number, number][] = [[262, 0, 0.3], [392, 0.16, 0.55]];
  notes.forEach(([f, delay, len]) => {
    const s = t0 + delay;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.4, s + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    o.connect(lp).connect(g).connect(c.destination);
    o.start(s); o.stop(s + len);
  });
}

/** Pawn (Piyon) = soft wooden tap. */
function tap(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 0.13;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(620, t0);
  o.frequency.exponentialRampToValueAtTime(280, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.4, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur);
}

const SYNTH: Record<string, (c: AudioContext) => void> = {
  N: horse, B: elephant, R: thud, Q: chime, K: horn, P: tap,
};

/** Maçlarda (Bota Karşı / Arkadaşla) her hamlede çalınan NÖTR ses (madde 2).
 *  Yukarıdaki at kişnemesi / fil borusu gibi eğlence sesleri SADECE ders
 *  pratiğinde kullanılır — gerçek maçta rahatsız eder. Burada gerçek bir
 *  satranç taşının tahtaya konuşuna benzeyen KISA ve ALÇAK sesli bir tık
 *  çalınır: sporcuyu rahatsız etmeyecek kadar kısık, hamlenin oynandığını
 *  hissettirecek kadar duyulur. */
function moveTap(c: AudioContext) {
  const t0 = c.currentTime;
  const dur = 0.07;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(340, t0);
  o.frequency.exponentialRampToValueAtTime(180, t0 + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.16, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(lp).connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur);
}

export function playMoveSound() {
  const c = getCtx();
  if (!c) return;
  try { moveTap(c); } catch { /* audio not available */ }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function playPieceSound(pieceType?: string | null) {
  if (!pieceType) return;
  const letter = pieceType.slice(-1).toUpperCase();
  probe(letter);                 // lazily look for a real recording
  if (playFile(letter)) return;  // use it once available
  const c = getCtx();
  if (!c) return;
  try {
    (SYNTH[letter] ?? tap)(c);
  } catch { /* audio not available */ }
}
