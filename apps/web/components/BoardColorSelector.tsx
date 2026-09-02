'use client';
import { BOARD_COLOR_ORDER, BOARD_COLORS } from '@/lib/boardColors';
import { useBoardPrefs } from '@/lib/board-prefs-context';

// Mini 4×4 tahta önizlemesi — ChessThemeSelector'daki MiniBoard ile aynı desen.
function MiniBoard({ light, dark }: { light: string; dark: string }) {
  const cells = Array.from({ length: 16 }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const isLight = (row + col) % 2 === 0;
    return isLight ? light : dark;
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

export function BoardColorSelector() {
  const { boardColorId, setBoardColorId } = useBoardPrefs();

  return (
    <div className="grid gap-2">
      {BOARD_COLOR_ORDER.map((id) => {
        const c = BOARD_COLORS[id];
        const active = boardColorId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setBoardColorId(active ? null : id)}
            className={[
              't-card-i flex items-center gap-3 px-3 py-3 transition-all text-left w-full',
              active ? 'ring-2' : '',
            ].join(' ')}
            style={active ? { '--tw-ring-color': 'var(--t-accent)' } as React.CSSProperties : {}}
            aria-pressed={active}
          >
            <MiniBoard light={c.light} dark={c.dark} />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm">{c.name}</span>
              {active && <span className="ml-2 t-tag-ac text-xs px-2 py-0.5">Aktif</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
