'use client';

/** Çıkış için PC/TV kapatma tuşu tarzı canlı (neon) güç ikonu. */
export function PowerButton({
  onClick,
  title = 'Çıkış',
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button onClick={onClick} aria-label={title} title={title} className="power-btn">
      <svg
        width="22"
        height="22"
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
