'use client';
import type { StepInfo } from '@/lib/admin/movePieceSteps';

interface Props {
  steps: StepInfo[];
  /** Eksik olan ILK adimin numarasi (vurgulanir); null = eksik yok. */
  missingNo: number | null;
  ariaLabel: string;
}

/** Sirali adim listesi: ✓ / numara + etiket. Is mantigi YOK — sunum. */
export function StepList({ steps, missingNo, ariaLabel }: Props) {
  return (
    <ol className="grid gap-1.5" aria-label={ariaLabel}>
      {steps.map((st) => {
        const active = !st.done && st.no === missingNo;
        return (
          <li key={st.no} className="flex items-center gap-2 text-xs"
            style={{ opacity: st.done || active ? 1 : 0.45 }}>
            <span className="flex items-center justify-center rounded-full flex-shrink-0 font-bold"
              style={{
                width: 20, height: 20, fontSize: '0.65rem',
                border: `1.5px solid ${st.done ? '#34d399' : 'rgba(255,255,255,0.25)'}`,
                color: st.done ? '#34d399' : 'rgba(255,255,255,0.6)',
              }}>
              {st.done ? '✓' : st.no}
            </span>
            <span style={{ color: st.done ? '#34d399' : undefined }}>
              {st.no}. {st.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
