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
  /** Rematch butonunun metni. Verilmezse "Yeniden Oyna" (geriye dönük uyumlu). */
  rematchLabel?: string;
}

/** Diğer maç düzenlerinde de (bkz. PracticeMatchLayout) aynı kart kutuları
 *  kullanılsın diye dışa açık — burada BİR KEZ tanımlanır, kopyalanmaz. */
export function cardBorder(active: boolean) {
  return {
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'var(--t-surface-2)' : undefined,
  };
}

/** Kare kart — Avatar. */
export function AvatarBox({ avatarId, active }: { avatarId: string; active: boolean }) {
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="mc-square t-card-i flex items-center justify-center"
      style={cardBorder(active)}
    >
      <span className="text-2xl" aria-hidden="true">{avatarEmoji(avatarId)}</span>
    </div>
  );
}

/** Dikdörtgen kart — oyuncu ismi. */
export function NameBox({ name, active }: { name: string; active: boolean }) {
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="mc-rect t-card-i flex items-center justify-center text-center px-2"
      style={cardBorder(active)}
    >
      <span className="font-semibold text-sm truncate">{name}</span>
    </div>
  );
}

/** Kare kart — kalan süre. Sıra bu oyuncudaysa köşede yanan bir LED ışığı
 *  vardır (madde 4, 2026-08-19). */
export function TimeBox({ ms, active }: { ms: number | null; active: boolean }) {
  const low = ms !== null && isLowTime(ms);
  return (
    <div
      data-active={active ? 'true' : 'false'}
      className="mc-square t-card-i flex items-center justify-center"
      style={{ ...cardBorder(active), position: 'relative' }}
    >
      {active && (
        <span aria-hidden="true" className="mc-led" />
      )}
      <span
        className="font-mono font-bold tabular-nums text-sm"
        style={{ color: low ? '#f87171' : 'var(--t-text)' }}
      >
        {ms === null ? '—' : formatClock(ms)}
      </span>
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
  rematchLabel = 'Yeniden Oyna',
}: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 space-y-2">
      <div className="match-grid">
        <div className="ml-avatar-top">
          <AvatarBox avatarId={top.avatarId} active={top.active} />
        </div>
        <div className="ml-name-top">
          <NameBox name={top.name} active={top.active} />
        </div>
        <div className="ml-time-top">
          <TimeBox ms={top.ms} active={top.active} />
        </div>
        <div className="ml-board">{board}</div>
        <div className="ml-avatar-bottom">
          <AvatarBox avatarId={bottom.avatarId} active={bottom.active} />
        </div>
        <div className="ml-name-bottom">
          <NameBox name={bottom.name} active={bottom.active} />
        </div>
        <div className="ml-time-bottom">
          <TimeBox ms={bottom.ms} active={bottom.active} />
        </div>
        <div className="ml-moves">{moveList}</div>
        <div className="ml-act-draw mc-rect">
          <button
            type="button"
            disabled={drawDisabled || over}
            onClick={onOfferDraw}
            className="t-btn-ghost w-full h-full px-2 py-2 text-sm text-center disabled:opacity-40"
          >
            {drawLabel}
          </button>
        </div>
        <div className="ml-act-resign mc-square">
          <button
            type="button"
            disabled={over}
            onClick={() => { if (confirm('Maçı terk etmek istiyor musun? Maçı kaybedeceksin.')) onResign(); }}
            className="t-btn w-full h-full px-2 py-2 text-sm text-center disabled:opacity-40"
            style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
          >
            Terk Et
          </button>
        </div>
        {onRematch && (
          <div className="ml-act-rematch mc-rect">
            <button
              type="button"
              disabled={!rematchEnabled}
              onClick={onRematch}
              className="t-btn-ghost w-full h-full px-2 py-2 text-sm text-center disabled:opacity-40"
            >
              {rematchLabel}
            </button>
          </div>
        )}
      </div>
      {over && resultSlot}
      {extra}
    </div>
  );
}
