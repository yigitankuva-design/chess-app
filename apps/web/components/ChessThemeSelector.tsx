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
      className="grid grid-cols-4 w-14 h-14 rounded overflow-hidden shadow-inner flex-shrink-0"
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
      <h2 className="font-bold text-lg mb-3">🎨 Tahta Teması</h2>
      <div className="grid gap-2">
        {CHESS_THEMES.map((t) => {
          const active = t.id === themeId;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as ChessThemeId)}
              className={[
                'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full',
                'hover:scale-[1.01] active:scale-[0.99]',
                active
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md'
                  : 'border-transparent bg-gray-50 dark:bg-gray-800 hover:border-gray-300',
              ].join(' ')}
              aria-pressed={active}
            >
              <MiniBoard lightSquare={t.lightSquare} darkSquare={t.darkSquare} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.emoji}</span>
                  <span className="font-semibold text-sm">{t.name}</span>
                  {active && (
                    <span className="ml-auto text-blue-500 text-xs font-medium bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                      Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {t.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
