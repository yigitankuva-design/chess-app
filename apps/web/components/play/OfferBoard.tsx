'use client';
import { useState } from 'react';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';
import { offerSummary, tempoEmoji } from '@/lib/play/offers';
import { TIME_GROUPS } from '@/lib/play/levels';
import type { TimeControl } from '@/components/BotGame';
import { COLOR_CHOICES } from '@/lib/play/color';
import type { ColorChoice } from '@/lib/play/color';

/** Teklif panosu: acik teklifleri listeler, tek dokunusla mac baslatir,
 *  uygun teklif yoksa sporcunun kendi teklifini birakmasini saglar.
 *  Mac yonlendirmesi LobbyProvider'da — bu bilesen onMatched ALMAZ. */
export function OfferBoard() {
  const { offers, myOffer, notice, createOffer, cancelOffer, takeOffer } =
    useLobbyContext();
  const [formOpen, setFormOpen] = useState(false);
  const [tc, setTc] = useState<{ tempo: string; item: TimeControl } | null>(null);
  const [color, setColor] = useState<ColorChoice>('random');

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  function publish() {
    if (!tc) return;   // sure secilmeden teklif yayinlanmaz
    createOffer({
      tempo: tc.tempo,
      tc_label: tc.item.label,
      tc_base: tc.item.base,
      tc_increment: tc.item.increment,
      color,
    });
    setFormOpen(false);
    setTc(null);
  }

  return (
    <div className="space-y-4">
      {notice && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{notice}</p>}

      {myOffer && (
        <div className="t-card-i flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide">
              Teklifin panoda
            </p>
            <p className="text-sm mt-0.5">
              {tempoEmoji(myOffer.tempo)} {myOffer.tempo} · {myOffer.tc_label} ·{' '}
              {COLOR_CHOICES.find((c) => c.value === myOffer.color)?.label ?? ''}
            </p>
          </div>
          <button type="button" onClick={cancelOffer}
            className="t-btn-ghost px-3 py-2 text-xs flex-shrink-0">
            Teklifini İptal Et
          </button>
        </div>
      )}

      <p className="text-xs font-semibold t-muted uppercase tracking-widest">
        Açık Teklifler ({offers.length})
      </p>

      {offers.length === 0 ? (
        <p className="text-sm t-muted">
          Şu an açık teklif yok. Sen bir teklif bırak, arkadaşların görsün.
        </p>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => (
            <div key={o.child_id} className="t-card-i flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{o.display_name}</p>
                <p className="text-xs t-muted mt-0.5">{offerSummary(o)}</p>
              </div>
              <button
                type="button"
                onClick={() => takeOffer(o.child_id)}
                aria-label={`${o.display_name} teklifini al`}
                className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                style={{
                  width: 52, height: 52, fontSize: '0.7rem',
                  border: '2px solid var(--t-accent)', color: 'var(--t-accent)',
                }}
              >
                OYNA
              </button>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button type="button" onClick={() => setFormOpen(true)}
          className="w-full py-3 rounded-xl text-sm font-bold"
          style={{ background: 'var(--t-accent)', color: '#fff' }}>
          + Maç Teklif Et
        </button>
      ) : (
        <div className="t-card-i p-4 space-y-4">
          {TIME_GROUPS.map((g) => (
            <div key={g.cat} className="space-y-2">
              <p className="text-xs font-semibold t-muted uppercase tracking-wide flex items-center gap-1.5">
                <span>{g.emoji}</span> {g.cat}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((item) => (
                  <button key={item.label} type="button"
                    onClick={() => setTc({ tempo: g.cat, item })}
                    className="py-3 rounded-xl text-sm font-bold transition-all"
                    style={pill(tc?.item.label === item.label)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <p className="text-xs font-semibold t-muted uppercase tracking-wide">Renk</p>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_CHOICES.map((c) => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className="py-3 rounded-xl text-sm font-bold transition-all"
                  style={pill(color === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={publish} disabled={!tc}
              className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-40"
              style={{ background: 'var(--t-accent)', color: '#fff' }}>
              ▶️ Teklifi Yayınla
            </button>
            {/* Teklif KALDIRMA burada degil, yukaridaki "Teklifin panoda"
                satirindadir — iki farkli yerde ayni is yapilmaz. */}
            <button type="button" onClick={() => { setFormOpen(false); setTc(null); }}
              className="t-btn-ghost px-4 py-3 text-sm">
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
