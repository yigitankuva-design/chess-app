'use client';
import { AVATARS } from '@/lib/avatars';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function AvatarSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          aria-label={a.label}
          className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition ${
            value === a.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className="text-4xl">{a.emoji}</span>
          <span className="text-xs opacity-75">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
