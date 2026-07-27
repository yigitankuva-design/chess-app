/** Son 10 saniyede saat kirmizi olur ve ondalik gosterir. */
const LOW_MS = 10_000;

export function isLowTime(ms: number): boolean {
  return ms < LOW_MS;
}

/** ms -> "MM:SS", son 10 sn'de "SS.d". Negatif deger ASLA eksi gostermez. */
export function formatClock(ms: number): string {
  const safe = ms > 0 ? ms : 0;
  // Sure BITTIGINDE ondalik degil, klasik 00:00 gosterilir — bayrak dusmus
  // saat "00.0" diye degil "00:00" diye okunur.
  if (safe === 0) return '00:00';
  if (safe < LOW_MS) {
    const s = Math.floor(safe / 1000);
    const d = Math.floor((safe % 1000) / 100);
    return `${String(s).padStart(2, '0')}.${d}`;
  }
  const total = Math.floor(safe / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
