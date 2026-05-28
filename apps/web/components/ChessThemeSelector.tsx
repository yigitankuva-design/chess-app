'use client';
import { CHESS_THEMES, ChessThemeId } from '@/lib/chess-themes';
import { useChessTheme } from '@/lib/chess-theme-context';

// Mini board preview — 4×4 grid showing theme colors
function MiniBoard({ lightSquare, darkSquare }: { lightSquare: string; darkSquare: string }) {
  const cells = Array.from({ length: 16 }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const isLight = (row + col) % 2 === 0;
    return isLight ? lightSquare : darkSquare;
  });

  return (
    <div
      className="grid grid-cols-4 w-14 h-14 rounded overflow-hidden flex-shrink-0"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
      aria-hidden="true"
    >
      {cells.map((bg, i) => (
        <div key={i} style={{ backgroundColor: bg }} />
      ))}
    </div>
  );
}

export function ChessThemeSelector() {
  const { themeId, setTheme } = useChessTheme();

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-3">
        🎨 Tahta Teması
      </p>
      <div className="grid gap-2">
        {CHESS_THEMES.map((t) => {
          const active = t.id === themeId;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ChessThemeId)}
              className={[
                't-card-i flex items-center gap-3 px-3 py-3 transition-all text-left w-full',
                active ? 'ring-2' : '',
              ].join(' ')}
              style={active ? { '--tw-ring-color': 'var(--t-accent)' } as React.CSSProperties : {}}
              aria-pressed={active}
            >
              <MiniBoard lightSquare={t.lightSquare} darkSquare={t.darkSquare} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.emoji}</span>
                  <span className="font-semibold text-sm">{t.name}</span>
                  {active && (
                    <span className="ml-auto t-tag-ac text-xs px-2 py-0.5">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs t-muted mt-0.5 truncate">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
