'use client';
import type { ReactNode } from 'react';
import { formatClock, isLowTime } from '@/lib/play/clockFormat';
import { avatarEmoji } from '@/lib/avatars';

export interface PlayerInfo {
  avatarId: string;
  name: string;
  /** Kalan süre (ms). null => saatsiz maç: kutu "—" gösterir. */
  ms: number | null;
  /** Sırası bu oyuncuda mı — kutu vurgulanır. */
  active: boolean;
}

interface Props {
  /** Tahtanın ÜSTÜNDE gösterilen taraf (rakip / bot). */
  top: PlayerInfo;
  /** Tahtanın ALTINDA gösterilen taraf (sporcunun kendisi). */
  bottom: PlayerInfo;
  board: ReactNode;
  moveList: ReactNode;
  /** Hamle listesinin altında, buton satırının üstünde serbest alan
   *  (bilgi mesajı, beraberlik teklifi kartı, "bot düşünüyor" vb.). */
  extra?: ReactNode;
  over: boolean;
  resultSlot?: ReactNode;
  drawLabel: string;
  drawDisabled: boolean;
  onOfferDraw: () => void;
  onResign: () => void;
  /** Verilmezse "Yeniden Oyna" butonu HİÇ render edilmez (insan-insan maçı). */
  onRematch?: () => void;
  rematchEnabled?: boolean;
}

function TimeBox({ ms, active }: { ms: number | null; active: boolean }) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="t-card-i flex items-center justify-center flex-shrink-0"
      style={{
        minWidth: 'clamp(3.2rem, 14vw, 4.5rem)',
        minHeight: '2.5rem',
        border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
        background: active ? 'var(--t-surface-2)' : undefined,
      }}
    >
      <span
        className="font-mono font-bold tabular-nums text-sm"
        style={{ color: low ? '#f87171' : 'var(--t-text)' }}
      >
        {ms === null ? '—' : formatClock(ms)}
      </span>
    </div>
  );
}

function PlayerBadge({ avatarId, name, active }: { avatarId: string; name: string; active: boolean }) {
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="t-card-i flex items-center gap-2 px-3 py-2 min-w-0"
      style={{ border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)' }}
    >
      <span className="text-2xl flex-shrink-0" aria-hidden="true">{avatarEmoji(avatarId)}</span>
      <span className="font-semibold text-sm truncate">{name}</span>
    </div>
  );
}

/** Maç ekranının hem dikey hem yatay kullanıma uyan yerleşimi.
 *
 *  TEK BİR DOM AĞACI kurulur — dikey/yatay için AYRI JSX bloğu YAZILMAZ.
 *  Sebep: iki blok yazılsaydı "Terk Et" gibi butonlar DOM'da İKİ KEZ
 *  oluşurdu; mevcut testler (`getByRole('button', {name:'Terk Et'})`) TEK
 *  eşleşme bekliyor ve kırılırdı. Bunun yerine `.match-grid` (app/globals.css)
 *  CSS Grid `grid-template-areas`'ı `@media (orientation: landscape)` ile
 *  DEĞİŞTİRİR — aynı öğeler farklı hücrelere taşınır, hiçbiri ikinci kez
 *  render edilmez.
 */
export function MatchLayout({
  top, bottom, board, moveList, extra, over, resultSlot,
  drawLabel, drawDisabled, onOfferDraw, onResign, onRematch, rematchEnabled,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 space-y-2">
      <div className="match-grid">
        <div className="ml-avatar-top">
          <PlayerBadge avatarId={top.avatarId} name={top.name} active={top.active} />
        </div>
        <div className="ml-time-top">
          <TimeBox ms={top.ms} active={top.active} />
        </div>
        <div className="ml-board">{board}</div>
        <div className="ml-avatar-bottom">
          <PlayerBadge avatarId={bottom.avatarId} name={bottom.name} active={bottom.active} />
        </div>
        <div className="ml-time-bottom">
          <TimeBox ms={bottom.ms} active={bottom.active} />
        </div>
        <div className="ml-moves">{moveList}</div>
        <div className="ml-actions">
          <button
            type="button"
            disabled={drawDisabled || over}
            onClick={onOfferDraw}
            className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
          >
            {drawLabel}
          </button>
          <button
            type="button"
            disabled={over}
            onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) onResign(); }}
            className="t-btn px-4 py-2 text-sm disabled:opacity-40"
            style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
          >
            Terk Et
          </button>
          {onRematch && (
            <button
              type="button"
              disabled={!rematchEnabled}
              onClick={onRematch}
              className="t-btn-ghost px-4 py-2 text-sm disabled:opacity-40"
            >
              Yeniden Oyna
            </button>
          )}
        </div>
      </div>
      {over && resultSlot}
      {extra}
    </div>
  );
}
