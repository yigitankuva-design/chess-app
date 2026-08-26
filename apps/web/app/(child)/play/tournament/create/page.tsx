'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTournament } from '@/lib/tournamentsApi';
import { useSettings } from '@/lib/settings/settings-context';
import type { TimeControl } from '@/components/BotGame';

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** "Turnuva Oluştur" — Lichess Arena modeli (2026-09-05): sabit tur yerine
 *  sabit SÜRE seçilir. Kriter ekranının tam yerleşimi Zafer'in göndereceği
 *  görsele göre İNCELTİLECEK — şimdilik işlevsel, mevcut kart dilinde. */
export default function TournamentCreatePage() {
  const router = useRouter();
  const { settings } = useSettings();
  const timeGroups = settings.play.timeGroups;
  const defaults = settings.play.tournamentDefaults;
  const defaultTc = timeGroups.flatMap((g) => g.items).find((i) => i.label === defaults.timeControlLabel) ?? null;

  const [name, setName] = useState('');
  const [duration, setDuration] = useState(defaults.durationMinutes);
  const [tc, setTc] = useState<TimeControl | null>(defaultTc);
  const [rated, setRated] = useState(defaults.rated);
  const [startLater, setStartLater] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)' : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  const canCreate = name.trim().length > 0 && !!tc && (!startLater || startAt.length > 0);

  async function create() {
    if (!canCreate || !tc) return;
    const startsAtIso = startLater && startAt ? new Date(startAt).toISOString() : new Date().toISOString();
    setBusy(true); setMsg(null);
    const created = await createTournament({
      name: name.trim(),
      starts_at: startsAtIso, duration_minutes: duration,
      base_ms: tc.base * 1000, increment_ms: tc.increment * 1000,
      rated,
    });
    setBusy(false);
    if (!created) { setMsg('Turnuva oluşturulamadı'); return; }
    router.push(`/play/tournament/${created.id}`);
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <p className="font-semibold text-sm">➕ Turnuva Oluştur</p>

      <div className="t-card-i p-4">
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Turnuva adı (örn. Yaz Turnuvası)"
          className="w-full px-4 py-3 rounded-xl text-sm"
          style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)' }} />
      </div>

      <div className="t-card-i p-4 space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Süre</p>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDuration(d)}
              className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(duration === d)}>
              {d} dk
            </button>
          ))}
        </div>
      </div>

      <div className="t-card-i p-4 space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Tempo</p>
        {timeGroups.map((g) => (
          <div key={g.cat} className="space-y-1.5">
            <p className="text-xs t-muted flex items-center gap-1.5">
              <span>{g.emoji}</span> {g.cat}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((item) => (
                <button key={item.label} type="button" onClick={() => setTc(item)}
                  className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(tc?.label === item.label)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="t-card-i p-4 space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Başlangıç</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setStartLater(false)}
            className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(!startLater)}>
            Hemen Başlat
          </button>
          <button type="button" onClick={() => setStartLater(true)}
            className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(startLater)}>
            İleride Başlat
          </button>
        </div>
        {startLater && (
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)' }} />
        )}
      </div>

      <div className="t-card-i p-4 space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Oyun Modu</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setRated(true)}
            className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(rated)}>
            🏆 Puanlı
          </button>
          <button type="button" onClick={() => setRated(false)}
            className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(!rated)}>
            Puansız
          </button>
        </div>
      </div>

      {msg && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}

      <button type="button" onClick={create} disabled={busy || !canCreate}
        className="w-full py-3.5 rounded-xl text-base font-bold transition-all shadow-sm disabled:opacity-40"
        style={{ background: 'var(--t-accent)', color: '#fff' }}>
        {busy ? 'Oluşturuluyor...' : '🏆 Turnuvayı Oluştur'}
      </button>
    </main>
  );
}
