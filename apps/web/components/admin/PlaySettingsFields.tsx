'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import type { AppSettingsData, PlayTimeGroup } from '@/lib/settings/defaults';
import type { PlayLevel } from '@/lib/play/levels';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Props {
  play: AppSettingsData['play'];
  onSaved: () => void;
}

/**
 * Madde 2026-09-05 (2+5): Admin'den Maç Yap'ın gerçek oyun ayarları
 * düzenlenir — bot seviyeleri (skill/derinlik/hata payı), süre kontrolü
 * seçenekleri (Yıldırım/Hızlı/Klasik içindeki item'lar) ve sporcunun
 * turnuva oluştururken göreceği varsayılanlar. Her blok kendi "Kaydet"
 * butonuyla `PATCH /admin/settings` body'sinde `{ play: { <blok> } }`
 * gönderir — backend deep-merge yaptığı için diğer bloklar etkilenmez.
 */
export function PlaySettingsFields({ play, onSaved }: Props) {
  const [levels, setLevels] = useState<PlayLevel[]>(play.levels);
  const [timeGroups, setTimeGroups] = useState<PlayTimeGroup[]>(play.timeGroups);
  const [tournamentDefaults, setTournamentDefaults] = useState(play.tournamentDefaults);
  const [savingLevels, setSavingLevels] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [savingTournament, setSavingTournament] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function patchPlay(patch: Record<string, unknown>): Promise<boolean> {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ play: patch }),
    });
    return r.ok;
  }

  function setLevelField(idx: number, field: keyof PlayLevel, value: number) {
    setLevels((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  async function saveLevels() {
    setSavingLevels(true); setMsg(null);
    const ok = await patchPlay({ levels });
    setSavingLevels(false);
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    onSaved();
  }

  function setTimeItem(catIdx: number, itemIdx: number, patch: Partial<PlayTimeGroup['items'][number]>) {
    setTimeGroups((prev) => prev.map((g, i) => (
      i !== catIdx ? g : { ...g, items: g.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)) }
    )));
  }

  function removeTimeItem(catIdx: number, itemIdx: number) {
    setTimeGroups((prev) => prev.map((g, i) => (
      i !== catIdx ? g : { ...g, items: g.items.filter((_, j) => j !== itemIdx) }
    )));
  }

  function addTimeItem(catIdx: number) {
    setTimeGroups((prev) => prev.map((g, i) => (
      i !== catIdx ? g : { ...g, items: [...g.items, { label: 'Yeni', base: 300, increment: 0 }] }
    )));
  }

  async function saveTimeGroups() {
    setSavingTime(true); setMsg(null);
    const ok = await patchPlay({ timeGroups });
    setSavingTime(false);
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    onSaved();
  }

  async function saveTournamentDefaults() {
    setSavingTournament(true); setMsg(null);
    const ok = await patchPlay({ tournamentDefaults });
    setSavingTournament(false);
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    onSaved();
  }

  const allTimeLabels = timeGroups.flatMap((g) => g.items.map((i) => i.label));

  return (
    <div className="space-y-4">
      {msg && <p className="text-xs text-cyan-300">{msg}</p>}

      {/* ── Bot Seviyeleri ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest">Bot Seviyeleri</p>
        <div className="space-y-1.5">
          {levels.map((l, idx) => (
            <div key={l.level} className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center text-xs">
              <span className="n-muted w-14">Düzey {l.level}</span>
              <label className="flex items-center gap-1">
                <span className="n-muted">Skill</span>
                <input type="number" min={0} max={20} value={l.skill}
                  onChange={(e) => setLevelField(idx, 'skill', Number(e.target.value))}
                  className="neon-input text-xs px-2 py-1 w-full" />
              </label>
              <label className="flex items-center gap-1">
                <span className="n-muted">Derinlik</span>
                <input type="number" min={1} value={l.depth}
                  onChange={(e) => setLevelField(idx, 'depth', Number(e.target.value))}
                  className="neon-input text-xs px-2 py-1 w-full" />
              </label>
              <label className="flex items-center gap-1">
                <span className="n-muted">Hata %</span>
                <input type="number" min={0} max={100} value={Math.round(l.blunderChance * 100)}
                  onChange={(e) => setLevelField(idx, 'blunderChance', Number(e.target.value) / 100)}
                  className="neon-input text-xs px-2 py-1 w-full" />
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={saveLevels} disabled={savingLevels}
          className="px-3 py-1.5 rounded-md bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-xs transition-colors">
          {savingLevels ? 'Kaydediliyor...' : 'Bot seviyelerini kaydet'}
        </button>
      </div>

      {/* ── Süre Kontrolü ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <p className="text-xs font-bold n-muted uppercase tracking-widest">Süre Kontrolü</p>
        {timeGroups.map((g, catIdx) => (
          <div key={g.cat} className="space-y-1.5">
            <p className="text-xs n-muted flex items-center gap-1.5">
              <span>{g.emoji}</span> {g.cat}
            </p>
            {g.items.map((item, itemIdx) => (
              <div key={itemIdx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center text-xs">
                <input value={item.label} onChange={(e) => setTimeItem(catIdx, itemIdx, { label: e.target.value })}
                  placeholder="Etiket (örn. 5+3)" className="neon-input text-xs px-2 py-1 w-full" />
                <label className="flex items-center gap-1">
                  <span className="n-muted">dk</span>
                  <input type="number" min={0} value={item.base / 60}
                    onChange={(e) => setTimeItem(catIdx, itemIdx, { base: Number(e.target.value) * 60 })}
                    className="neon-input text-xs px-2 py-1 w-full" />
                </label>
                <label className="flex items-center gap-1">
                  <span className="n-muted">artış sn</span>
                  <input type="number" min={0} value={item.increment}
                    onChange={(e) => setTimeItem(catIdx, itemIdx, { increment: Number(e.target.value) })}
                    className="neon-input text-xs px-2 py-1 w-full" />
                </label>
                <button type="button" onClick={() => removeTimeItem(catIdx, itemIdx)}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
                  Sil
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addTimeItem(catIdx)}
              className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">
              + Süre Ekle
            </button>
          </div>
        ))}
        <button type="button" onClick={saveTimeGroups} disabled={savingTime}
          className="px-3 py-1.5 rounded-md bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-xs transition-colors">
          {savingTime ? 'Kaydediliyor...' : 'Süre kontrolünü kaydet'}
        </button>
      </div>

      {/* ── Turnuva Varsayılanları ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest">Turnuva Varsayılanları</p>
        <p className="text-xs n-muted">Sporcu turnuva oluştururken formda bu değerler baştan seçili gelir.</p>
        <label className="flex items-center gap-2 text-xs">
          <span className="n-muted w-20">Tur sayısı</span>
          <input type="number" min={1} value={tournamentDefaults.roundsTotal}
            onChange={(e) => setTournamentDefaults((p) => ({ ...p, roundsTotal: Number(e.target.value) }))}
            className="neon-input text-xs px-2 py-1 w-24" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="n-muted w-20">Süre</span>
          <select value={tournamentDefaults.timeControlLabel}
            onChange={(e) => setTournamentDefaults((p) => ({ ...p, timeControlLabel: e.target.value }))}
            className="neon-input text-xs px-2 py-1">
            {allTimeLabels.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={tournamentDefaults.rated}
            onChange={(e) => setTournamentDefaults((p) => ({ ...p, rated: e.target.checked }))} />
          <span className="n-muted">Varsayılan olarak Puanlı</span>
        </label>
        <button type="button" onClick={saveTournamentDefaults} disabled={savingTournament}
          className="px-3 py-1.5 rounded-md bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-xs transition-colors">
          {savingTournament ? 'Kaydediliyor...' : 'Turnuva varsayılanlarını kaydet'}
        </button>
      </div>
    </div>
  );
}
