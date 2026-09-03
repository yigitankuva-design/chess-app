'use client';
import type { ReactNode } from 'react';
import { AvatarBox, NameBox, TimeBox } from '@/components/play/MatchLayout';
import type { PlayerInfo } from '@/components/play/MatchLayout';

/** Pratiğin bittiği anki sonuç — geri bildirim kartının rengini/metnini belirler. */
export type PracticeOutcome = 'win' | 'draw' | 'loss';

export interface PracticeAction {
  /** Ekranda gösterilen tek karakter/emoji — kartlarda YAZI olmaz (madde 2c). */
  icon: string;
  /** Ekranda görünmez, ekran okuyucu ve test'ler için. */
  label: string;
  onClick: () => void;
  enabled: boolean;
}

interface Props {
  top: PlayerInfo;
  bottom: PlayerInfo;
  board: ReactNode;
  moveList: ReactNode;
  /** Pratik hâlâ sürüyorsa null — geri bildirim kartı o zaman hiç render edilmez. */
  outcome: PracticeOutcome | null;
  /** Bota karşı pratikte 4 eylem (tekrar et, beraberlik, terk et, farklı
   *  konum); arkadaş maçında (LiveGame) 3 eylem (beraberlik, terk et,
   *  tekrar oyna) — sayı sabit değil, `.pm-actions-row` flex olduğu için
   *  otomatik ortalanır. */
  actions: PracticeAction[];
  /** Terfi seçici, reddedilen beraberlik notu gibi serbest alan (board/eylemler arası). */
  extra?: ReactNode;
  /** Geri bildirim kartı metni — verilmezse bota karşı pratiğin varsayılan
   *  metinleri kullanılır. Arkadaş maçında (LiveGame) "Bot Kazandı" gibi
   *  bota özel ifadeler anlamsız olduğu için override edilir. */
  outcomeText?: Partial<Record<PracticeOutcome, string>>;
  /** Madde 2026-09-03 (2): verilirse `outcome`/`outcomeText` YERİNE bu TAM
   *  metin gösterilir (örn. "⏰ Süren bitti — Bot kazandı.") — gerçek maç
   *  ekranının (Bota Karşı Maç Yap) sebebe göre değişen sonuç mesajları
   *  için. Kart RENGİ yine `outcome`'dan gelir (win/draw/loss). */
  resultText?: string;
  /** Madde 2026-09-04 (2): verilirse geri bildirim kartının alanı (butonlar
   *  ile notasyon ARASINDAKİ TEK yer) `outcome`/`resultText` YERİNE bunu
   *  gösterir — renkli `OUTCOME_CLASS` UYGULANMAZ (içerik kendi kart
   *  görünümünü taşır, örn. MatchAnalysisSummary). "Analiz Et" tıklanınca
   *  kazandın/kaybettin kartının YERİNE analiz özetinin gelmesi için. */
  feedbackOverride?: ReactNode;
}

const DEFAULT_OUTCOME_TEXT: Record<PracticeOutcome, string> = {
  win: 'Tebrikler Kazandın',
  draw: 'Berabere Bitti',
  loss: 'Bot Kazandı',
};
const OUTCOME_CLASS: Record<PracticeOutcome, string> = {
  win: 't-ok',
  draw: 't-info',
  loss: 't-err',
};

/**
 * Pratik Yap ekranı (Kazanç Konumu / Oyunsonu / Açılış — bota karşı pratik).
 * Gerçek maç ekranından (MatchLayout) BAĞIMSIZDIR: 4 dairesel, ikon'lu eylem
 * kartı + renkli geri bildirim + EN ALTTA notasyon. Yalnızca BotGame'in
 * `practiceActions` verildiği dallarda kullanılır.
 */
export function PracticeMatchLayout({
  top, bottom, board, moveList, outcome, actions, extra, outcomeText, resultText,
  feedbackOverride,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto px-4 space-y-2">
      <div className="pm-grid">
        <div className="pm-avatar-top"><AvatarBox avatarId={top.avatarId} active={top.active} /></div>
        <div className="pm-name-top"><NameBox name={top.name} active={top.active} /></div>
        <div className="pm-time-top"><TimeBox ms={top.ms} active={top.active} /></div>
        <div className="pm-board">{board}</div>
        <div className="pm-avatar-bottom"><AvatarBox avatarId={bottom.avatarId} active={bottom.active} /></div>
        <div className="pm-name-bottom"><NameBox name={bottom.name} active={bottom.active} /></div>
        <div className="pm-time-bottom"><TimeBox ms={bottom.ms} active={bottom.active} /></div>

        <div className="pm-actions">
          <div className="pm-actions-row">
            {actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={!a.enabled}
                data-enabled={a.enabled ? 'true' : 'false'}
                aria-label={a.label}
                className="pm-circle t-card-i"
              >
                <span aria-hidden="true">{a.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {feedbackOverride ? (
          <div className="pm-feedback">{feedbackOverride}</div>
        ) : outcome && (
          <div className={`pm-feedback ${OUTCOME_CLASS[outcome]} p-4 text-center text-lg font-bold`}>
            {resultText ?? outcomeText?.[outcome] ?? DEFAULT_OUTCOME_TEXT[outcome]}
          </div>
        )}

        <div className="pm-moves">{moveList}</div>
      </div>
      {extra}
    </div>
  );
}
