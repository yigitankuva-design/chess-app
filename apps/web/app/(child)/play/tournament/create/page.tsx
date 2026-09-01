'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTournament } from '@/lib/tournamentsApi';
import { useSettings } from '@/lib/settings/settings-context';
import { tempoCategoryOfLabel } from '@/lib/play/levels';
import type { TimeControl } from '@/components/BotGame';

/** Turnuvanın toplam süresi (dakika) — Zafer'in görseldeki tam liste. */
const DURATIONS = [
  20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120,
  150, 180, 210, 240, 270, 300, 330, 360, 420, 480, 540, 600, 660, 720,
];

/** Madde 2026-09-XX: İsviçre'de "Tur Arası Süre" — sabit 4 seçenek. */
const ROUND_GAP_OPTIONS = [5, 10, 15, 30] as const;

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function todayDateValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowTimeValue(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "Turnuva Oluştur" — Zafer'in gönderdiği ikinci görsele göre yeniden
 *  düzenlendi (madde 2026-09-XX): Turnuva İsmi+Türü üstte (ayırıcı çizgiyle),
 *  ardından Süre/Tur Sayısı+Tempo, Tarih+Saat, Konum+Puan Durumu, Galibiyet
 *  Ödülü+Berserk, en altta Açıklama.
 *
 *  İsviçre seçilince 3 kart KAPANIR (disabled, sporcu seçim yapamaz):
 *  - "Tur Sayısı": artık sporcu SEÇMİYOR — katılım kapanınca (1. tur
 *    üretilirken) katılımcı sayısına göre backend'de otomatik hesaplanır
 *    (bkz. services/swiss.py::compute_rounds_total). Kutuda sabit
 *    "Katılımcıya Göre Değişir" yazar.
 *  - "Galibiyet Ödülü" ve "Berserk": İsviçre'de HİÇ kullanılmıyor (Zafer'in
 *    kararı) — "Olmasın" değerinde donuk kalır. Backend da bunu ayrıca
 *    zorluyor (schemas/tournament.py::_type_specific_fields), frontend'in
 *    devre dışı bırakmasına güvenilmiyor.
 *
 *  Berserk'in ayrıca eski tempo kısıtı (SADECE Yıldırım/Hızlı, Klasik'te
 *  yok) da duruyor — Klasik tempoda Arena'da bile kapalı/donuk görünür.
 *
 *  Madde 2026-09-XX ("Tur Arası Süre"): İsviçre'de "Başlangıç Konumu/FEN"
 *  alanının YERİNE "Tur Arası Süre" (5/10/15/30 dk) seçimi gelir — bir tur
 *  bitince sıradaki tur artık anında değil, bu kadar süre sonra üretilir
 *  (bkz. services/swiss.py::advance_swiss_tournament). İsviçre'de FEN
 *  belirlenemez, her zaman standart başlangıçtan oynanır. */
export default function TournamentCreatePage() {
  const router = useRouter();
  const { settings } = useSettings();
  const timeGroups = settings.play.timeGroups;
  const defaults = settings.play.tournamentDefaults;
  const defaultTc = timeGroups.flatMap((g) => g.items).find((i) => i.label === defaults.timeControlLabel) ?? null;
  const defaultDuration = DURATIONS.includes(defaults.durationMinutes) ? defaults.durationMinutes : 60;

  const [name, setName] = useState('');
  const [duration, setDuration] = useState(defaultDuration);
  const [startDate, setStartDate] = useState(todayDateValue());
  const [startTime, setStartTime] = useState(nowTimeValue());
  const [description, setDescription] = useState('');
  const [tc, setTc] = useState<TimeControl | null>(defaultTc);
  const [startFen, setStartFen] = useState('');
  const [roundGapMinutes, setRoundGapMinutes] = useState<typeof ROUND_GAP_OPTIONS[number]>(5);
  const [rated, setRated] = useState(defaults.rated);
  const [winningStreakBonus, setWinningStreakBonus] = useState(true);
  const [tournamentType, setTournamentType] = useState<'arena' | 'swiss'>('arena');
  const [berserkEnabled, setBerserkEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isSwiss = tournamentType === 'swiss';
  // Berserk SADECE arena + Yıldırım/Hızlı tempoda anlamlı (services/tempo.py
  // ile AYNI 3 kategori) — İsviçre'de veya Klasik'te kart KAPALI (disabled)
  // gösterilir, artık görselden hiç kaybolmaz (madde 2026-09-XX).
  const tempoCat = tc ? tempoCategoryOfLabel(tc.label) : '';
  const berserkAllowed = !isSwiss && (tempoCat === 'Yıldırım' || tempoCat === 'Hızlı');

  const canCreate = name.trim().length > 0 && !!tc && startDate.length > 0 && startTime.length > 0;

  async function create() {
    if (!canCreate || !tc) return;
    const startsAtIso = new Date(`${startDate}T${startTime}`).toISOString();
    setBusy(true); setMsg(null);
    const result = await createTournament({
      name: name.trim(),
      starts_at: startsAtIso,
      duration_minutes: isSwiss ? null : duration,
      base_ms: tc.base * 1000, increment_ms: tc.increment * 1000,
      rated,
      description: description.trim() || null,
      // Madde 2026-09-XX: İsviçre'de bu alan yok — slot "Tur Arası Süre"ye
      // döndü (backend de start_fen'i İsviçre'de zaten None'a zorluyor).
      start_fen: isSwiss ? null : (startFen.trim() || null),
      round_gap_minutes: isSwiss ? roundGapMinutes : null,
      // İsviçre'de kullanılmaz — kart kapalıyken ekranda görünen "Olmasın"
      // ile TUTARLI olsun diye gönderilen değer de burada zorlanır (backend
      // ayrıca kendi başına da zorluyor, bkz. yukarıdaki yorum).
      winning_streak_bonus: isSwiss ? false : winningStreakBonus,
      tournament_type: tournamentType,
      // Tur sayısı artık sporcu tarafından seçilmiyor — backend katılım
      // kapanınca otomatik hesaplar (bkz. services/swiss.py).
      rounds_total: null,
      berserk_enabled: berserkAllowed && berserkEnabled,
    });
    setBusy(false);
    if (!result.ok) { setMsg(result.error); return; }
    router.push(`/play/tournament/${result.data.id}`);
  }

  // Madde 2026-09-09: başlıklar artık sadece BAŞ HARFİ büyük — 'uppercase'
  // CSS'i kaldırıldı (yoksa aşağıdaki string'ler ne yazılırsa yazılsın
  // görsel olarak hep BÜYÜK HARF görünürdü).
  const labelCls = 'text-xs font-semibold t-muted tracking-wide block mb-1.5';
  const disabledSelectCls = 'w-full px-3 py-3 rounded-xl text-sm disabled:opacity-40';

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <p className="font-semibold text-sm">➕ Turnuva Oluştur</p>

      {/* Satır 1: Turnuva İsmi + Turnuva Türü */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div>
          <label htmlFor="t-name" className={labelCls}>Turnuva ismi</label>
          <input id="t-name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="örn. Yaz Turnuvası"
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="t-type" className={labelCls}>Turnuva türü</label>
          <select id="t-type" value={tournamentType}
            onChange={(e) => setTournamentType(e.target.value === 'swiss' ? 'swiss' : 'arena')}
            className="w-full px-3 py-3 rounded-xl text-sm" style={inputStyle}>
            <option value="arena">Arena Turnuvası</option>
            <option value="swiss">İsviçre Turnuvası</option>
          </select>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--t-border)' }} />

      {/* Satır 2: Turnuva Süresi/Tur Sayısı + Maç Süresi (Tempo) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="t-duration" className={labelCls}>
            {isSwiss ? 'Tur sayısı' : 'Turnuva süresi'}
          </label>
          {isSwiss ? (
            <input id="t-duration" disabled readOnly value="Katılımcıya Göre Değişir"
              className="w-full px-4 py-3 rounded-xl text-sm disabled:opacity-40" style={inputStyle} />
          ) : (
            <select id="t-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-3 rounded-xl text-sm" style={inputStyle}>
              {DURATIONS.map((d) => <option key={d} value={d}>{d} dk</option>)}
            </select>
          )}
        </div>
        <div>
          <label htmlFor="t-tempo" className={labelCls}>Maç süresi (tempo)</label>
          <select id="t-tempo" value={tc?.label ?? ''}
            onChange={(e) => setTc(timeGroups.flatMap((g) => g.items).find((i) => i.label === e.target.value) ?? null)}
            className="w-full px-3 py-3 rounded-xl text-sm" style={inputStyle}>
            {timeGroups.map((g) => (
              <optgroup key={g.cat} label={`${g.emoji} ${g.cat}`}>
                {g.items.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Satır 3: Başlangıç Tarihi + Başlangıç Saati */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="t-date" className={labelCls}>Başlangıç tarihi</label>
          <input id="t-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="t-time" className={labelCls}>Başlangıç saati</label>
          <input id="t-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
        </div>
      </div>

      {/* Satır 4: (Arena: Başlangıç Konumu/FEN | İsviçre: Tur Arası Süre) + Puan Durumu */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          {isSwiss ? (
            <>
              <label htmlFor="t-round-gap" className={labelCls}>Tur arası süre</label>
              <select id="t-round-gap" value={roundGapMinutes}
                onChange={(e) => setRoundGapMinutes(Number(e.target.value) as typeof ROUND_GAP_OPTIONS[number])}
                className="w-full px-3 py-3 rounded-xl text-sm" style={inputStyle}>
                {ROUND_GAP_OPTIONS.map((m) => <option key={m} value={m}>{m} dk</option>)}
              </select>
            </>
          ) : (
            <>
              <label htmlFor="t-fen" className={labelCls}>Başlangıç konumu/FEN</label>
              <input id="t-fen" value={startFen} onChange={(e) => setStartFen(e.target.value)}
                placeholder="Boş = standart başlangıç, veya FEN yapıştır"
                className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
            </>
          )}
        </div>
        <div>
          <label htmlFor="t-rated" className={labelCls}>Puan durumu</label>
          <select id="t-rated" value={rated ? 'rated' : 'unrated'} onChange={(e) => setRated(e.target.value === 'rated')}
            className="w-full px-3 py-3 rounded-xl text-sm" style={inputStyle}>
            <option value="rated">Puanlı</option>
            <option value="unrated">Puansız</option>
          </select>
        </div>
      </div>

      {/* Satır 5: Galibiyet Ödülü + Berserk — ikisi de İsviçre'de KAPALI
          (disabled, "Olmasın" donuk); Berserk ayrıca Klasik tempoda da
          kapalı (eski kısıt, madde 2026-09-10'dan değişmedi). */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="t-streak" className={labelCls}>Galibiyet ödülü</label>
          <select id="t-streak" value={isSwiss ? 'off' : (winningStreakBonus ? 'on' : 'off')}
            onChange={(e) => setWinningStreakBonus(e.target.value === 'on')}
            disabled={isSwiss}
            className={disabledSelectCls} style={inputStyle}>
            <option value="on">Ödül Olsun</option>
            <option value="off">Ödül Olmasın</option>
          </select>
        </div>
        <div>
          <label htmlFor="t-berserk" className={labelCls}>Berserk</label>
          <select id="t-berserk" value={berserkAllowed ? (berserkEnabled ? 'on' : 'off') : 'off'}
            onChange={(e) => setBerserkEnabled(e.target.value === 'on')}
            disabled={!berserkAllowed}
            className={disabledSelectCls} style={inputStyle}>
            <option value="on">Olsun</option>
            <option value="off">Olmasın</option>
          </select>
        </div>
      </div>

      {/* Satır 6: Turnuva İle İlgili Turnuva Kurucusunun Açıklamaları */}
      <div>
        <label htmlFor="t-desc" className={labelCls}>Turnuva ile ilgili turnuva kurucusunun açıklamaları</label>
        <textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Turnuva hakkında sporculara göstermek istediğin bir not (opsiyonel)"
          rows={5}
          className="w-full px-4 py-3 rounded-xl text-sm resize-none" style={inputStyle} />
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
