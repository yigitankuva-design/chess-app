import { TIME_GROUPS } from '@/lib/play/levels';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';

/** Sunucudan gelen teklif satiri (/ws/lobby "offers" mesaji). */
export interface LobbyOffer {
  child_id: number;
  display_name: string;
  tempo: string;
  tc_label: string;
  tc_base: number;
  tc_increment: number;
  color: ColorChoice;
  /** Madde 6 (2026-08-20): "Oyun Modu" — Puanlıysa rating/title de gelir. */
  rated?: boolean;
  rating?: number | null;
  title?: string | null;
}

/** Tempo adinin emojisi. Bilinmeyen tempo icin BOS dizge — uydurulmaz. */
export function tempoEmoji(tempo: string): string {
  return TIME_GROUPS.find((g) => g.cat === tempo)?.emoji ?? '';
}

/** Teklifi ALANIN oynayacagi renk. Panoya bakan kisi icin anlamli olan budur. */
export function takerColorChoice(owner: ColorChoice): ColorChoice {
  if (owner === 'white') return 'black';
  if (owner === 'black') return 'white';
  return 'random';
}

/** Satir ozeti: "⚡ Yildirim · 5+0 · Sen: ⚫ Siyah" */
export function offerSummary(o: LobbyOffer): string {
  const taker = takerColorChoice(o.color);
  const c = COLOR_CHOICES.find((x) => x.value === taker);
  const emoji = tempoEmoji(o.tempo);
  const tempoPart = emoji ? `${emoji} ${o.tempo}` : o.tempo;
  return `${tempoPart} · ${o.tc_label} · Sen: ${c?.emoji ?? ''} ${c?.label ?? ''}`;
}
