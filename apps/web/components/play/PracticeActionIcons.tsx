/**
 * Madde 2026-09-06 (5): "Tahtanın Yönünü Değiştir" (🔄) ve "Yeniden Oyna" /
 * "Konumu Yeniden Tekrar Et" (🔁) dairesel kartlarının simgeleri, görünüşteki
 * benzerlikleri nedeniyle karışabiliyordu. Bu iki bileşen onları ayrıştırır:
 * FlipBoardIcon dikey (yukarı-aşağı) oklu, ReplayIcon köşeli değil TAM
 * ÇEMBER biçiminde — ikisi de PracticeMatchLayout'un `PracticeAction.icon`
 * (artık ReactNode) alanına geçilir.
 */

/** "Tahtanın Yönünü Değiştir" — 🔄 emojisi 90° döndürülüp oklar dikey
 *  (yukarı-aşağı) hale getirilir. */
export function FlipBoardIcon() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', transform: 'rotate(90deg)' }}>
      🔄
    </span>
  );
}

/** "Yeniden Oyna" / "Konumu Yeniden Tekrar Et" — köşeli ok yerine TAM ÇEMBER
 *  biçiminde özgün bir "tekrar" simgesi (GameMoveList.tsx'teki NavIcon SVG
 *  deseniyle aynı viewBox/stroke stili — jenerik bir geometrik şekil,
 *  hiçbir üçüncü taraf ikon setinden kopyalanmadı). */
export function ReplayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.05 14.57 A7.5 7.5 0 1 1 15.75 5.51" />
      <polygon points="12.6,4.2 18.6,4.9 15.5,9.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
