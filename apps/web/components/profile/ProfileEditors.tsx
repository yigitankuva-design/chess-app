'use client';
import { useState } from 'react';
import type { ProfileEditOutcome, ProfileEditPatch } from '@/lib/gamification/meApi';
import { TURKIYE_ILLERI, ULKELER, VARSAYILAN_ULKE } from '@/lib/turkiye';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): profil kartlarındaki
 * düzenleme parçaları — sporcu (ProfileView) ve antrenör (coach/profile)
 * AYNI bileşenleri kullanır, sadece `onSave` farklı uca gider.
 *
 * Kurallar (Zafer): isim ve e-posta salt-okunur (bu bileşenlerde YOK);
 * nickname 3 ayda 1 kez (sunucu kilidi, burada geri sayım gösterilir);
 * ülke listesi (Türkiye varsayılan), şehir 81 il.
 *
 * Tasarım: kartlar mobilde dar (375px'te kimlik kartının yarısı ~80px) —
 * bu yüzden düzenleme düğmesi küçük bir kalem ikonu (kartın köşesine
 * sabitlenebilir) ve form kartın İÇİNDE değil, alttan açılan bir
 * "sheet"te (tam genişlik) gösterilir. Canlı önizlemede metin düğmesi
 * kartı taşırıyordu.
 */

type Save = (patch: ProfileEditPatch) => Promise<ProfileEditOutcome>;

/** Kalem ikonlu küçük düzenleme düğmesi. `corner` → kartın sağ üst
 *  köşesine sabitlenir (kart `relative` olmalı). */
export function EditButton({ onClick, label, corner }: { onClick: () => void; label: string; corner?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${corner ? 'absolute top-2 right-2' : ''}`}
      style={{ background: 'var(--t-surface-2)', color: 'var(--t-accent)' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

const inputStyle = {
  background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)',
} as const;
const inputClass = 'rounded-lg px-3 py-2 text-sm w-full mt-1';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wide t-muted';

/** Alttan açılan düzenleme paneli — tam genişlik, Kaydet/Vazgeç. Dışa
 *  açık — CoachNoteCard.tsx (Aşama E) da AYNI mobil-dar-kart deseniyle
 *  bunu kullanır (kendi kopyasını yazmak yerine). */
export function EditSheet({ title, busy, err, onSave, onCancel, children }: {
  title: string; busy: boolean; err: string | null; onSave: () => void; onCancel: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`${title} düzenleme paneli`}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-xl rounded-t-2xl p-4 pb-6 space-y-3" style={{ background: 'var(--t-surface)' }}>
        <p className="text-xs font-bold uppercase tracking-wide t-muted">{title}</p>
        {children}
        {err && <p className="text-xs" style={{ color: 'var(--t-err-text)' }}>{err}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onSave} disabled={busy}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button type="button" onClick={onCancel} disabled={busy}
            className="flex-1 px-3 py-2.5 rounded-xl text-sm font-bold t-muted"
            style={{ background: 'var(--t-surface-2)' }}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

/** Kilit süresi dolmadıysa kalan gün — dolduysa/yoksa null. */
export function nicknameLockDays(nextChangeAt: string | null | undefined, now = new Date()): number | null {
  if (!nextChangeAt) return null;
  const diff = new Date(nextChangeAt).getTime() - now.getTime();
  if (diff <= 0) return null;
  return Math.ceil(diff / 86_400_000);
}

interface NicknameProps {
  value: string | null | undefined;
  nextChangeAt: string | null | undefined;
  readOnly?: boolean;
  onSave: Save;
  onSaved?: (nickname: string | null, nextChangeAt: string | null) => void;
}

export function NicknameEditor({ value, nextChangeAt, readOnly, onSave, onSaved }: NicknameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lockDays = nicknameLockDays(nextChangeAt);

  async function save() {
    setBusy(true); setErr(null);
    const res = await onSave({ nickname: draft });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onSaved?.(res.data.nickname, res.data.nickname_next_change_at);
    setEditing(false);
  }
  function cancel() { setEditing(false); setDraft(value ?? ''); setErr(null); }

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide t-muted">Nickname</p>
      {value
        ? <p className="font-bold text-base leading-tight truncate">{value}</p>
        : <p className="font-bold text-base leading-tight truncate t-muted italic">Henüz eklenmedi</p>}
      {!readOnly && lockDays !== null && (
        <p className="text-[10px] t-muted mt-0.5 leading-tight">🔒 {lockDays} gün sonra değiştirebilirsin</p>
      )}
      {!readOnly && lockDays === null && (
        <EditButton corner onClick={() => { setDraft(value ?? ''); setEditing(true); }} label="Nickname düzenle" />
      )}
      {editing && (
        <EditSheet title="Nickname" busy={busy} err={err} onSave={save} onCancel={cancel}>
          <label className={labelClass}>
            Nickname
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={24}
              aria-label="Nickname" placeholder="2–24 karakter" autoFocus
              className={inputClass} style={inputStyle} />
          </label>
          <p className="text-[11px] t-muted">Maçlarda gerçek ismin yerine bu görünür. 3 ayda 1 kez değiştirilebilir.</p>
        </EditSheet>
      )}
    </div>
  );
}

interface LocationProps {
  country: string | null | undefined;
  province: string | null | undefined;
  memberSinceLabel: string;
  readOnly?: boolean;
  onSave: Save;
  onSaved?: (country: string | null, province: string | null) => void;
  /** Sporcu kartı 3 bölümlü (bayrak | ülke+il | üyelik); antrenörde üyelik altta. */
  layout?: 'sporcu' | 'antrenor';
}

export function LocationEditor({ country, province, memberSinceLabel, readOnly, onSave, onSaved, layout = 'sporcu' }: LocationProps) {
  const [editing, setEditing] = useState(false);
  const [dCountry, setDCountry] = useState(country || VARSAYILAN_ULKE);
  const [dProvince, setDProvince] = useState(province ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const shownCountry = country || VARSAYILAN_ULKE;

  async function save() {
    setBusy(true); setErr(null);
    const res = await onSave({ country: dCountry, province: dProvince || null });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onSaved?.(res.data.country, res.data.province);
    setEditing(false);
  }
  function cancel() { setEditing(false); setDCountry(country || VARSAYILAN_ULKE); setDProvince(province ?? ''); setErr(null); }

  const text = (
    <p className="font-semibold truncate">
      {shownCountry}{province && <span className="t-muted font-normal"> ({province})</span>}
    </p>
  );
  const edit = !readOnly && (
    <EditButton corner onClick={() => { setDCountry(country || VARSAYILAN_ULKE); setDProvince(province ?? ''); setEditing(true); }} label="Ülke ve şehir düzenle" />
  );
  const sheet = editing && (
    <EditSheet title="Ülke ve şehir" busy={busy} err={err} onSave={save} onCancel={cancel}>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Ülke
          <select value={dCountry} onChange={(e) => setDCountry(e.target.value)} aria-label="Ülke"
            className={`${inputClass} normal-case font-normal tracking-normal`} style={inputStyle}>
            {ULKELER.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Şehir
          <select value={dProvince} onChange={(e) => setDProvince(e.target.value)} aria-label="Şehir"
            className={`${inputClass} normal-case font-normal tracking-normal`} style={inputStyle}>
            <option value="">— Seç —</option>
            {TURKIYE_ILLERI.map((il) => <option key={il} value={il}>{il}</option>)}
          </select>
        </label>
      </div>
    </EditSheet>
  );

  if (layout === 'antrenor') {
    return (
      <div className="min-w-0 flex-1">
        {text}
        <p className="t-muted mt-0.5">Üyelik tarihi {memberSinceLabel}</p>
        {edit}
        {sheet}
      </div>
    );
  }
  return (
    <>
      <div className="flex-1 min-w-0">
        {text}
        {edit}
        {sheet}
      </div>
      <div className="w-px self-stretch" style={{ background: 'var(--t-border)' }} />
      <div className="flex-1 min-w-0">
        <p className="t-muted truncate">Üyelik tarihi {memberSinceLabel}</p>
      </div>
    </>
  );
}

interface ContactProps {
  phone: string | null | undefined;
  email: string | null | undefined;
  lichess: string | null | undefined;
  readOnly?: boolean;
  onSave: Save;
  onSaved?: (phone: string | null, lichess: string | null) => void;
  icons: { phone: React.ReactNode; mail: React.ReactNode; knight: React.ReactNode };
}

/** Telefon + Lichess düzenlenir; e-posta salt-okunur (giriş kimliği). */
export function ContactEditor({ phone, email, lichess, readOnly, onSave, onSaved, icons }: ContactProps) {
  const [editing, setEditing] = useState(false);
  const [dPhone, setDPhone] = useState(phone ?? '');
  const [dLichess, setDLichess] = useState(lichess ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    const res = await onSave({ athlete_phone: dPhone, lichess_username: dLichess });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onSaved?.(res.data.athlete_phone, res.data.lichess_username);
    setEditing(false);
  }
  function cancel() { setEditing(false); setDPhone(phone ?? ''); setDLichess(lichess ?? ''); setErr(null); }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2.5">
        {icons.phone}
        <span className={phone ? undefined : 't-muted italic'}>{phone ?? 'Telefon girilmedi'}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {icons.mail}
        <span className={email ? undefined : 't-muted italic'}>{email ?? 'E-posta girilmedi'}</span>
      </div>
      <div className="flex items-center gap-2.5">
        {icons.knight}
        <span className={lichess ? undefined : 't-muted italic'}>{lichess ?? 'Lichess kullanıcı adı girilmedi'}</span>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 pt-1">
          <EditButton onClick={() => { setDPhone(phone ?? ''); setDLichess(lichess ?? ''); setEditing(true); }} label="İletişim bilgilerini düzenle" />
          <span className="text-xs t-muted">Telefon ve Lichess adını düzenle</span>
        </div>
      )}
      {editing && (
        <EditSheet title="İletişim bilgileri" busy={busy} err={err} onSave={save} onCancel={cancel}>
          <label className={labelClass}>
            Telefon
            <input value={dPhone} onChange={(e) => setDPhone(e.target.value)} maxLength={30}
              aria-label="Telefon" placeholder="Telefon" inputMode="tel"
              className={inputClass} style={inputStyle} />
          </label>
          <div>
            <p className={labelClass}>E-posta <span className="normal-case tracking-normal font-normal">(değiştirilemez)</span></p>
            <p className="text-sm t-muted mt-1 truncate">{email ?? 'E-posta girilmedi'}</p>
          </div>
          <label className={labelClass}>
            Lichess kullanıcı adı
            <input value={dLichess} onChange={(e) => setDLichess(e.target.value)} maxLength={60}
              aria-label="Lichess kullanıcı adı" placeholder="Lichess kullanıcı adı"
              className={inputClass} style={inputStyle} />
          </label>
        </EditSheet>
      )}
    </div>
  );
}
