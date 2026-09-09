'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getToken } from '@/lib/auth-storage';
import { PowerButton } from '@/components/PowerButton';
import { TIME_GROUPS } from '@/lib/play/levels';
import { ChessThemeSelector } from '@/components/ChessThemeSelector';
import { BoardColorSelector } from '@/components/BoardColorSelector';
import { PieceSetSelector } from '@/components/PieceSetSelector';
import { fetchDaySummary } from '@/lib/activity/activityApi';
import type { DaySummary } from '@/lib/activity/activityApi';
import { fetchTeacherProgress, uploadTeacherPhoto } from '@/lib/gamification/meApi';
import type { MyProgress } from '@/lib/gamification/meApi';
import { resizeImageToDataUrl } from '@/lib/image/resizeImage';

/** "2018-08-07" → "7 Ağu 2018" (sporcu Profili'yle AYNI biçim). */
function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): "İletişim Bilgileri"
 *  kartının ikonları — components/profile/ProfileView.tsx'teki AYNI
 *  çizgi-ikonların kopyası (bu sayfa ProfileView'dan BAĞIMSIZ bir kopya —
 *  bkz. dosya başı not, KURAL #3). */
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 10.8c1.2 2.4 3.2 4.4 5.6 5.6l1.9-1.9c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V19c0 .6-.4 1-1 1C10.6 20 4 13.4 4 5c0-.6.4-1 1-1h3.1c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.3 0 .7-.2 1z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6 8.5-6" />
    </svg>
  );
}

function KnightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20h12" />
      <path d="M8 20l.6-4.5L6 13c-.6-1 .2-2.3 1.3-2.1l2 .4-.2-2.6c-.1-1.7 1-3.4 2.7-3.8L15 4l1.4 2.2c.6 1-.1 2.3-1.3 2.3h-.6l1 2.2c.5 1.1.2 2.4-.7 3.1L14 15l.7 5" />
      <circle cx="13" cy="7.3" r=".6" fill="var(--t-accent)" stroke="none" />
    </svg>
  );
}

/**
 * Madde 2026-09-07 (Antrenör Paneli, 3): Zafer'in isteğiyle sporcunun Profil
 * sayfası (bkz. components/profile/ProfileView.tsx) BİREBİR buraya taşındı
 * — aynı kartlar, aynı tasarım, aynı sıralama. ProfileView'ın KENDİSİ
 * değiştirilmedi (sporcu tarafı ve antrenörün "bir sporcuyu görüntüleme"
 * ekranı — /students/[id] — hâlâ onu kullanıyor, KURAL #3); bu SADECE
 * antrenörün KENDİ profili için AYRI bir kopya.
 *
 * Madde 2026-09-07 (devam, Zafer'in 5 maddelik düzenleme turu):
 * 1. "İletişim Bilgileri", "Ders İlerlemesi", "Not" kartları KALDIRILDI
 *    (o an antrenörün kendi profili için gösterecek GERÇEK veri yoktu).
 * 2. Kimlik fotoğrafı artık GERÇEK yükleme alanı — POST /teacher/me/photo
 *    (ChildProfile'ın POST /children/me/photo'suyla AYNI desen).
 * 3. Türkiye bayrağı %100 büyütüldü (aynı değişiklik sporcu tarafında da
 *    yapıldı — bkz. components/profile/ProfileView.tsx).
 *
 * Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): "İletişim Bilgileri"
 * kartı GERİ GETİRİLDİ — Zafer'in kararıyla: "Kayıt Ol" formu artık
 * antrenörün telefon/il/Lichess bilgisini gerçekten topluyor, gösterecek
 * veri var. Sporcu tarafındaki AYNI kart — ama Baba/Anne pill seçici YOK
 * (antrenörün velisi olmaz), doğrudan kendi telefon/e-posta/Lichess'i.
 * "Ders İlerlemesi"/"Not" kartları hâlâ YOK (antrenörün kendi profili için
 * hâlâ anlamsız).
 *
 * Kalan zorunlu teknik farklar (tasarım/kart sırası DEĞİŞMEDİ):
 * - Veri: rütbe/XP/rozet sistemi antrenör hesabında YOK — `GET
 *   /teacher/me/profile-summary` sadece gerçekten var olan alanları
 *   (isim, üyelik tarihi, fotoğraf, il/telefon/Lichess) doldurup
 *   rütbe/XP/rozeti null/0 döner.
 * - Performans Puanı / Genel Maç İstatistikleri / Güçlü-Zayıf Analiz /
 *   Turnuva Geçmişi: ProfileView'da da bunlar ZATEN örnek veri (henüz
 *   gerçek backend'e bağlı değil) — burada AYNEN kopyalandı.
 * - "Aktiflik Durumu - Bu Hafta": `/activity/day-summary` çocuk token'ı
 *   istiyor — antrenör için boş/sıfır gelir (grafik kartı yine de görünür,
 *   sadece "0 gün çalıştı" gösterir).
 */
export default function CoachProfilePage() {
  const router = useRouter();
  const { role, hydrated, logout } = useAuth();
  const [authReady, setAuthReady] = useState(false);
  const [me, setMe] = useState<MyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  const [ratingTempo, setRatingTempo] = useState<TempoKey>('Yıldırım');
  const [statsTempo, setStatsTempo] = useState<TempoKey>('Yıldırım');
  const [tourTempo, setTourTempo] = useState<TempoKey>('Yıldırım');
  const [activePanel, setActivePanel] = useState<SettingPanelId | null>(null);
  function togglePanel(id: SettingPanelId) {
    setActivePanel((cur) => (cur === id ? null : id));
  }

  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  function loadDaySummary(dateStr?: string) {
    fetchDaySummary(dateStr).then(setDaySummary);
  }
  useEffect(() => { loadDaySummary(); }, []);

  /** Madde 2026-09-07: fotoğraf yükleme — dairesel alana tıklayınca
   *  cihazdan/kameradan görsel seçilir, küçültülüp sunucuya gönderilir.
   *  Başarısızsa mevcut fotoğraf/ikon değişmeden kalır (KURAL #3). */
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(false);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const ok = await uploadTeacherPhoto(dataUrl);
      if (ok) {
        setMe((prev) => (prev ? { ...prev, photo_data_url: dataUrl } : prev));
      } else {
        setPhotoError(true);
      }
    } catch {
      setPhotoError(true);
    } finally {
      setPhotoUploading(false);
    }
  }

  useEffect(() => {
    if (!hydrated) return;
    if (!getToken() || role !== 'teacher') { router.replace('/'); return; }
    setAuthReady(true);
  }, [role, hydrated, router]);

  function handleLogout() {
    logout();
    router.replace('/');
  }

  useEffect(() => {
    fetchTeacherProgress().then((d) => {
      setMe(d);
      if (d?.display_name) setTeacherName(d.display_name);
      setLoading(false);
    });
  }, []);

  if (!authReady) return <p className="t-muted p-4">Yükleniyor...</p>;

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4">
        <div className="t-skel h-32 rounded-2xl" />
        <div className="t-skel h-24 rounded-2xl" />
        <div className="t-skel h-48 rounded-2xl" />
      </main>
    );
  }

  if (!me) {
    return (
      <main className="px-4 pt-8 pb-12 max-w-xl mx-auto text-center space-y-4">
        <p className="t-muted">Profil yüklenemedi. Giriş yaptın mı?</p>
        <div className="flex justify-center">
          <PowerButton onClick={handleLogout} />
        </div>
      </main>
    );
  }

  const rating = RATING_BY_TEMPO[ratingTempo];
  const stats = STATS_BY_TEMPO[statsTempo];
  const tour = TOURNAMENT_BY_TEMPO[tourTempo];

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-3">

      {/* 1) İsim + fotoğraf — tıklanınca cihazdan/kameradan seçim. */}
      <div className="t-card p-4 flex items-center gap-4">
        <label
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden cursor-pointer relative"
          style={{ background: 'var(--t-surface-2)' }}
          title="Fotoğraf yükle"
        >
          {me.photo_data_url
            ? <img src={me.photo_data_url} alt={teacherName ?? 'Antrenör fotoğrafı'} className="w-full h-full object-cover" />
            : '🎓'}
          {photoUploading && (
            <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
              …
            </span>
          )}
          <input
            type="file" accept="image/*" capture="user" className="hidden"
            aria-label="Fotoğraf yükle"
            onChange={(e) => { void handlePhotoSelected(e.target.files?.[0]); e.target.value = ''; }}
          />
        </label>
        <div className="min-w-0 flex-1">
          {teacherName && <p className="font-bold text-lg leading-tight truncate">{teacherName}</p>}
          <p className="text-xs t-muted uppercase tracking-widest mt-0.5">Antrenör</p>
          {photoError && <p className="text-xs mt-0.5" style={{ color: 'var(--t-err-text)' }}>Fotoğraf yüklenemedi, tekrar dene.</p>}
        </div>
      </div>

      {/* 2) Ülke + il + üyelik tarihi — madde 2026-09-07: bayrak %100
          büyütüldü. Madde 2026-09-09 (AŞAMA 4): il artık GERÇEK (antrenörün
          "Kayıt Ol" formunda girdiği) — sporcu tarafındaki AYNI desen. */}
      <div className="t-card p-4 flex items-center gap-2">
        <span className="text-5xl flex-shrink-0">🇹🇷</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            Türkiye{me.province && <span className="t-muted font-normal"> ({me.province})</span>}
          </p>
          <p className="t-muted mt-0.5">Üyelik tarihi {formatMemberSince(me.member_since)}</p>
        </div>
      </div>

      {/* 3) İletişim Bilgileri — madde 2026-09-09 (Üyelik Girişi Yenileme,
          AŞAMA 4): Zafer'in kararıyla geri getirildi (bkz. dosya başı not) —
          artık gerçek veri var (telefon/e-posta/Lichess, "Kayıt Ol"
          formundan). Sporcu tarafındaki AYNI kart tasarımı — ama antrenörün
          Baba/Anne'si olmadığı için pill seçici YOK, doğrudan gösterilir. */}
      <div className="t-card p-4">
        <div className="mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <span className="text-xs font-bold uppercase tracking-wide t-muted">İletişim Bilgileri</span>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2.5">
            <PhoneIcon />
            <span className={me.athlete_phone ? undefined : 't-muted italic'}>{me.athlete_phone ?? 'Telefon girilmedi'}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MailIcon />
            <span className={me.athlete_email ? undefined : 't-muted italic'}>{me.athlete_email ?? 'E-posta girilmedi'}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <KnightIcon />
            <span className={me.lichess_username ? undefined : 't-muted italic'}>
              {me.lichess_username ?? 'Lichess kullanıcı adı girilmedi'}
            </span>
          </div>
        </div>
      </div>

      {/* 4) Performans Puanı — sporcu tarafında da ZATEN örnek veri. */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Performans Puanı</span>
          <TempoSelector value={ratingTempo} onChange={setRatingTempo} />
        </div>
        {rating.hasData ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-mono tabular-nums text-3xl font-bold">{rating.value}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--t-ok-text)' }}>{rating.delta}</span>
            </div>
            <p className="text-xs t-muted mb-2">{rating.caption}</p>
            <svg viewBox="0 0 100 24" className="w-full h-6" preserveAspectRatio="none">
              <polyline points={rating.points} fill="none" stroke="var(--t-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <p className="text-sm t-muted text-center py-5">Bu tempoda henüz maç yok</p>
        )}
      </div>

      {/* 4) Genel Maç İstatistikleri */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Genel Maç İstatistikleri</span>
          <TempoSelector value={statsTempo} onChange={setStatsTempo} />
        </div>
        {stats.hasData ? (
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile label="Toplam Maç" value={stats.total} />
            <StatTile label="Galibiyet Oranı" value={stats.winRate} tone="ok" />
            <StatTile label="En Uzun Seri" value={stats.streak} />
            <StatTile label="En Güçlü Galibiyet" value={stats.bestWin} />
          </div>
        ) : (
          <p className="text-sm t-muted text-center py-5">Bu tempoda henüz maç yok</p>
        )}
      </div>

      {/* 5) Aktiflik Durumu - Bu Hafta */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-2.5 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Aktiflik Durumu - Bu Hafta</span>
          <span className="text-xs font-bold" style={{ color: 'var(--t-accent)' }}>
            {(daySummary?.week_days ?? []).filter((d) => d.has_activity).length} gün çalıştı
          </span>
        </div>
        <div className="flex gap-2">
          {(daySummary?.week_days ?? WEEK_DAYS.map((_, i) => ({ date: '', weekday: i, has_activity: false }))).map((d, i) => (
            <button
              key={d.date || i}
              type="button"
              onClick={() => d.date && loadDaySummary(d.date)}
              aria-pressed={daySummary?.date === d.date}
              className="flex-1 text-center"
            >
              <div
                className="w-full aspect-square rounded-lg"
                style={{
                  background: d.has_activity ? 'var(--t-accent)' : 'var(--t-surface-2)',
                  outline: daySummary?.date === d.date ? '2px solid var(--t-accent)' : 'none',
                  outlineOffset: '2px',
                }}
              />
              <div className="text-[10px] t-muted mt-1">{WEEK_DAYS[i]}</div>
            </button>
          ))}
        </div>

        {daySummary?.daily && daySummary?.monthly && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
            {ACTIVITY_CATEGORIES.map((c) => (
              <div key={c.key} className="rounded-xl p-2.5 text-center" style={{ background: 'var(--t-surface-2)' }}>
                <p className="text-lg leading-none mb-1">{c.emoji}</p>
                <p className="text-[11px] font-bold t-muted mb-1">{c.label}</p>
                <p className="text-[11px] t-text">
                  Günlük: <span className="font-bold">{formatDuration(daySummary.daily[c.key])}</span>
                </p>
                <p className="text-[11px] t-text">
                  Aylık: <span className="font-bold">{formatDuration(daySummary.monthly[c.key])}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6) Güçlü/Zayıf Yön Analizi */}
      <div className="t-card p-4">
        <div className="pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Güçlü / Zayıf Yön Analizi</span>
        </div>
        <div className="flex flex-col gap-4 mt-3">
          {SKILL_AREAS.map((s) => (
            <div key={s.label}>
              <p className="text-sm font-bold mb-1.5">{s.label}</p>
              <div className="relative h-2.5 rounded-full" style={{ background: 'var(--t-surface-2)' }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.pct}%`, background: 'var(--t-accent)' }} />
                <span
                  className="font-mono tabular-nums absolute top-1/2 text-xs font-bold t-muted whitespace-nowrap"
                  style={{ left: `calc(${s.pct}% + 6px)`, transform: 'translateY(-50%)' }}
                >
                  %{s.pct}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7) Turnuva Geçmişi */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Turnuva Geçmişi</span>
          <TempoSelector value={tourTempo} onChange={setTourTempo} />
        </div>
        {tour.hasData ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Toplam Turnuva" value={tour.total} />
              <StatTile label="Galibiyet Oranı" value={tour.winRate} tone="ok" />
              <StatTile label="Beraberlik Oranı" value={tour.drawRate} />
              <StatTile label="Yenilgi Oranı" value={tour.lossRate} tone="err" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PodiumTile place={1} count={tour.first} color={SAKIN_PANEL_PODIUM.gold} />
              <PodiumTile place={2} count={tour.second} color={SAKIN_PANEL_PODIUM.silver} />
              <PodiumTile place={3} count={tour.third} color={SAKIN_PANEL_PODIUM.bronze} />
            </div>
          </div>
        ) : (
          <p className="text-sm t-muted text-center py-5">Bu tempoda henüz turnuva yok</p>
        )}
      </div>

      {/* Ana Sayfaya Dön — sporcu tarafında /home'a gider, burada /coach'a. */}
      <button
        onClick={() => router.push('/coach')}
        className="w-full t-btn py-3 text-base"
      >
        Ana Sayfaya Dön
      </button>

      {/* Açık panel — kart sırasının HEMEN ÜSTÜNDE */}
      {activePanel && (
        <div className="t-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wide t-muted">
              {SETTING_CARDS.find((c) => c.id === activePanel)?.label}
            </span>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              aria-label="Paneli kapat"
              className="w-6 h-6 rounded-md flex items-center justify-center text-sm t-muted hover:text-current"
              style={{ background: 'var(--t-surface-2)' }}
            >
              ✕
            </button>
          </div>
          {activePanel === 'theme' && <ChessThemeSelector />}
          {activePanel === 'board-color' && <BoardColorSelector />}
          {activePanel === 'pieces' && <PieceSetSelector />}
          {activePanel === 'language' && <LanguagePanel />}
        </div>
      )}

      {/* Ayar kartları + Çıkış (power ikonu) */}
      <div className="flex items-center justify-center gap-3 pt-1">
        {SETTING_CARDS.map((c) => (
          <SettingCircle
            key={c.id}
            emoji={c.emoji}
            label={c.label}
            active={activePanel === c.id}
            onClick={() => togglePanel(c.id)}
          />
        ))}
        <div className="w-px self-stretch my-1" style={{ background: 'var(--t-border)' }} />
        <PowerButton onClick={handleLogout} />
      </div>

    </main>
  );
}

type TempoKey = 'Yıldırım' | 'Hızlı' | 'Klasik';
const TEMPO_ORDER: TempoKey[] = ['Yıldırım', 'Hızlı', 'Klasik'];
function tempoEmoji(t: TempoKey): string {
  return TIME_GROUPS.find((g) => g.cat === t)?.emoji ?? '';
}

interface RatingSample { hasData: boolean; value: string; delta: string; caption: string; points: string }
const RATING_BY_TEMPO: Record<TempoKey, RatingSample> = {
  'Yıldırım': {
    hasData: true, value: '1042', delta: '▲ 18 bu hafta',
    caption: 'Yıldırım tempo · 20 maçlık sağlama süresi tamamlandı',
    points: '0,20 11,19 22,21 33,17 44,17 55,14 66,15 77,10 88,11 100,6',
  },
  'Hızlı': {
    hasData: true, value: '968', delta: '▲ 6 bu hafta',
    caption: 'Hızlı tempo · 20 maçlık sağlama süresi tamamlandı',
    points: '0,15 11,17 22,14 33,16 44,13 55,15 66,11 77,13 88,10 100,9',
  },
  'Klasik': { hasData: false, value: '', delta: '', caption: '', points: '' },
};

interface StatsSample { hasData: boolean; total: number; winRate: string; streak: string; bestWin: string }
const STATS_BY_TEMPO: Record<TempoKey, StatsSample> = {
  'Yıldırım': { hasData: true, total: 86, winRate: '%61', streak: '6 galibiyet', bestWin: '1180' },
  'Hızlı': { hasData: true, total: 34, winRate: '%53', streak: '4 galibiyet', bestWin: '1052' },
  'Klasik': { hasData: false, total: 0, winRate: '', streak: '', bestWin: '' },
};

interface TourSample {
  hasData: boolean; total: number; winRate: string; drawRate: string; lossRate: string;
  first: number; second: number; third: number;
}
const TOURNAMENT_BY_TEMPO: Record<TempoKey, TourSample> = {
  'Yıldırım': { hasData: true, total: 22, winRate: '%59', drawRate: '%14', lossRate: '%27', first: 2, second: 1, third: 3 },
  'Hızlı': { hasData: true, total: 9, winRate: '%44', drawRate: '%22', lossRate: '%34', first: 0, second: 1, third: 1 },
  'Klasik': { hasData: false, total: 0, winRate: '', drawRate: '', lossRate: '', first: 0, second: 0, third: 0 },
};

const SKILL_AREAS: { label: string; pct: number }[] = [
  { label: 'Açılış Performansı', pct: 74 },
  { label: 'Taktik Performansı', pct: 61 },
  { label: 'Kazanç Konumunu Sonuçlandırma', pct: 45 },
  { label: 'Oyun Sonu Performansı', pct: 38 },
];

const SAKIN_PANEL_PODIUM = { gold: '#E0A526', silver: '#9AA3AC', bronze: '#C0742F' };

const WEEK_DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const ACTIVITY_CATEGORIES: { key: 'play_seconds' | 'lessons_seconds' | 'practice_seconds'; label: string; emoji: string }[] = [
  { key: 'play_seconds', label: 'Maç Yap', emoji: '⚔️' },
  { key: 'lessons_seconds', label: 'Dersler', emoji: '📚' },
  { key: 'practice_seconds', label: 'Pratik Yap', emoji: '🌠' },
];

function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} dk`;
  return `${hours} saat ${minutes} dk`;
}

function TempoSelector({ value, onChange }: { value: TempoKey; onChange: (t: TempoKey) => void }) {
  return (
    <div className="flex gap-1.5">
      {TEMPO_ORDER.map((t) => (
        <button
          key={t} type="button" onClick={() => onChange(t)}
          aria-label={t} aria-pressed={value === t}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
          style={{ background: value === t ? 'var(--t-accent)' : 'var(--t-surface-2)' }}
        >
          {tempoEmoji(t)}
        </button>
      ))}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'err' }) {
  const color = tone === 'ok' ? 'var(--t-ok-text)' : tone === 'err' ? 'var(--t-err-text)' : 'var(--t-text-1)';
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--t-surface-2)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wide t-muted">{label}</div>
      <div className="font-mono tabular-nums text-xl font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function PodiumTile({ place, count, color }: { place: 1 | 2 | 3; count: number; color: string }) {
  const label = place === 1 ? '1.lik' : place === 2 ? '2.lik' : '3.lük';
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={color} className="mx-auto mb-1">
        <path d="M12 2l2.9 6.5L22 9l-5 4.9L18.2 22 12 18.3 5.8 22 7 13.9 2 9l7.1-.5L12 2z" />
      </svg>
      <div className="font-mono tabular-nums text-lg font-bold" style={{ color }}>{count}</div>
      <div className="text-[10px] t-muted">{label}</div>
    </div>
  );
}

type SettingPanelId = 'theme' | 'board-color' | 'pieces' | 'language';
const SETTING_CARDS: { id: SettingPanelId; emoji: string; label: string }[] = [
  { id: 'theme', emoji: '🎨', label: 'Tema Değiştir' },
  { id: 'board-color', emoji: '🔲', label: 'Tahta Renklerini Değiştir' },
  { id: 'pieces', emoji: '♞', label: 'Taş Görünümünü Değiştir' },
  { id: 'language', emoji: '🌐', label: 'Dil Seçeneği' },
];

function SettingCircle({ emoji, label, active, onClick }: {
  emoji: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-colors"
      style={{
        background: active ? 'var(--t-accent)' : 'var(--t-surface-2)',
        border: '1px solid var(--t-border)',
      }}
    >
      {emoji}
    </button>
  );
}

function LanguagePanel() {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'var(--t-surface-2)' }}>
      <span className="text-2xl">🇹🇷</span>
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm">Türkçe</span>
        <span className="ml-2 t-tag-ac text-xs px-2 py-0.5">Aktif</span>
      </div>
    </div>
  );
}
