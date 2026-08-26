'use client';
import { useState } from 'react';
import { ICON_POOL } from '@/lib/iconPool';
import { LEVEL_CODES, LEVEL_CODE_LABELS, LEVEL_CODE_COLORS, renderSectionIcon } from '@/lib/customTabs/levelBadge';

interface Props {
  value?: string | null;
  onChange: (icon: string) => void;
  /** Kapalı düğmenin kare boyutu (px). */
  size?: number;
  ariaLabel?: string;
  /** Madde 2026-09-05 (2): TS/TD/BD/OD/İD seviye rozetleri de seçilebilir
   *  olsun — yalnızca ALT SEKME ikon seçicilerinde açılır (varsayılan false). */
  showLevelBadges?: boolean;
}

/**
 * Madde 2/3 (2026-08-19): admin'in her yerde (sekme, alt sekme, düzey,
 * ders, alt konu) aynı ikon havuzundan seçim yapması için TEK, paylaşılan
 * bileşen — burada bir kez tanımlanır, kopyalanmaz.
 */
export function IconPicker({
  value, onChange, size = 36, ariaLabel = 'İkon seç', showLevelBadges = false,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="flex items-center justify-center rounded-lg text-xl leading-none transition-colors hover:bg-white/10"
        style={{
          width: size, height: size,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        {value ? renderSectionIcon(value, '➕') : '➕'}
      </button>
      {open && (
        <>
          {/* Dışına tıklayınca kapanır. */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
          />
          <div
            className="absolute z-20 mt-1 p-2 rounded-xl max-h-60 overflow-y-auto"
            style={{
              background: '#14141f',
              border: '1px solid rgba(255,255,255,0.15)',
              width: 288,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {showLevelBadges && (
              <>
                <p className="px-1 pb-1 text-[0.65rem] font-bold uppercase tracking-widest text-white/40">
                  Seviye Rozeti
                </p>
                <div className="grid grid-cols-8 gap-1 mb-2 pb-2 border-b border-white/10">
                  {LEVEL_CODES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => { onChange(code); setOpen(false); }}
                      aria-label={LEVEL_CODE_LABELS[code]}
                      title={LEVEL_CODE_LABELS[code]}
                      className="flex items-center justify-center rounded-md text-xs font-extrabold hover:bg-white/10"
                      style={{
                        width: 30, height: 30,
                        color: LEVEL_CODE_COLORS[code],
                        background: code === value ? 'rgba(34,211,238,0.25)' : 'transparent',
                        border: code === value ? '1px solid rgba(34,211,238,0.6)' : '1px solid transparent',
                      }}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="grid grid-cols-8 gap-1">
              {ICON_POOL.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => { onChange(ic); setOpen(false); }}
                  aria-label={`İkon: ${ic}`}
                  className="flex items-center justify-center rounded-md text-lg leading-none hover:bg-white/10"
                  style={{
                    width: 30, height: 30,
                    background: ic === value ? 'rgba(34,211,238,0.25)' : 'transparent',
                    border: ic === value ? '1px solid rgba(34,211,238,0.6)' : '1px solid transparent',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
