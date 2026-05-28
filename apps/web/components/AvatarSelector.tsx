'use client';
import { AVATARS } from '@/lib/avatars';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function AvatarSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          aria-label={a.label}
          aria-pressed={value === a.id}
          className={[
            't-card-i flex flex-col items-center gap-1 p-3 transition-all',
            value === a.id ? 'ring-2' : '',
          ].join(' ')}
          style={value === a.id ? { '--tw-ring-color': 'var(--t-accent)' } as React.CSSProperties : {}}
        >
          <span className="text-4xl">{a.emoji}</span>
          <span className="text-xs t-muted">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
