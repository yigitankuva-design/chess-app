'use client';

/** Acik yesil — o an baska aktif sporcu VAR. */
export const ACTIVE_GREEN = '#4ade80';
/** Kirmizi — baska aktif sporcu YOK. */
export const INACTIVE_RED = '#f87171';

/** Sayiya gore renk. Ikon rengi ve rozet ayni kaynaktan beslenir (DRY). */
export function activeColor(count: number): string {
  return count > 0 ? ACTIVE_GREEN : INACTIVE_RED;
}

/** "Arkadasla Oyna" yazisinin sonunda duran dairesel sayi rozeti. */
export function ActivePlayersBadge({ count }: { count: number }) {
  const color = activeColor(count);
  return (
    <span
      aria-label={`${count} aktif sporcu`}
      data-active={count > 0 ? 'true' : 'false'}
      className="inline-flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{
        minWidth: 20,
        height: 20,
        padding: '0 5px',
        fontSize: '0.68rem',
        backgroundColor: color,
        color: '#0b1020',
      }}
    >
      {count}
    </span>
  );
}
