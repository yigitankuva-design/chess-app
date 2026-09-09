'use client';

const DEFAULT_SIZE = 46;
const DEFAULT_ICON_SIZE = 22;

/**
 * Çıkış için PC/TV kapatma tuşu tarzı canlı (neon) güç ikonu.
 *
 * Zafer'in isteği (2026-09-09): Sporcu Profili'ndeki "Ana Sayfaya Dön"
 * altındaki daireler %40 büyütülecek — ama bu bileşen admin panelinde ve
 * antrenör profilinde de AYNI (küçük) boyutta kullanılıyor, global CSS
 * sınıfını (.power-btn) değiştirmek onları da etkilerdi. Bunun yerine
 * opsiyonel `size` eklendi — verilmezse davranış/boyut TAMAMEN AYNI kalır
 * (KURAL #3), sadece Sporcu Profili çağrısı büyük bir değer geçer.
 */
export function PowerButton({
  onClick,
  title = 'Çıkış',
  size = DEFAULT_SIZE,
}: {
  onClick: () => void;
  title?: string;
  size?: number;
}) {
  const iconSize = Math.round(size * (DEFAULT_ICON_SIZE / DEFAULT_SIZE));
  return (
    <button onClick={onClick} aria-label={title} title={title} className="power-btn" style={{ width: size, height: size }}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    </button>
  );
}
