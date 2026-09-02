'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getAthleteName } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { getSavedAvatar, avatarEmoji } from '@/lib/avatars';
import { PowerButton } from '@/components/PowerButton';
import { TIME_GROUPS } from '@/lib/play/levels';

interface Me {
  rank_name: string;
  rank_icon: string;
  xp_total: number;
  next_rank_xp: number;
  badges_earned: number;
  badges_total: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-XX: "Sporcu Profili" yeniden tasarlanıyor — tasarım
 * tuvalinde onaylanan "Sakin Panel" yönü, Zafer'in seçtiği 8 madde ve
 * SIRAYLA burada gerçek sayfaya aktarılıyor. Bu SADECE ŞEKİLSEL bir
 * aktarım: aşağıdaki tempo/düzey seçimleri gerçekten çalışır (yerel
 * state), ama sayılar/metinler ÖRNEK veridir — gerçek backend bağlantıları
 * (Performans Puanı, maç istatistikleri, ders ilerlemesi, güçlü/zayıf
 * analiz, turnuva geçmişi, hoca notu) ayrı bir işte yapılacak (Zafer'in
 * kararı: "önce şekil, sonra içerik bağlantısı").
 *
 * Kimlik şeridindeki unvan rozeti ve katılım tarihi bilinçli olarak
 * eklenmedi — ikisi de gerçek (Performans Puanı / kayıt) verisine
 * bağlanmadan sporcuya ait gerçekmiş gibi görünen bir bilgi olurdu.
 * Hoca notunun METNİ de aynı sebeple placeholder — "Zafer Hoca" gerçek
 * bir kişi, ona ait uydurma bir geri bildirim yazılmadı.
 *
 * Madde 2026-09-02: Zafer'in onayıyla tasarım tuvalinin özel paleti
 * (bkz. SAKIN_PANEL_PALETTE) SADECE bu sayfaya sabit uygulandı — uygulamanın
 * classic/night/neon tema seçiminden bağımsız, sporcu hangi temayı seçerse
 * seçsin Profil hep aynı krem/turuncu görünümde. Bilinçli bir seçim: Profil
 * bu yüzden geri kalan uygulamadan görsel olarak farklı görünüyor.
 */

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

// Madde 5: kodlar Zafer'in verdiği sırayla (TD-BD-OD-İD); isimler
// lib/settings/defaults.ts'teki gerçek düzey adlarıyla AYNI.
type LevelCode = 'TD' | 'BD' | 'OD' | 'İD';
const LEVEL_ORDER: LevelCode[] = ['TD', 'BD', 'OD', 'İD'];
const LEVEL_NAMES: Record<LevelCode, string> = {
  TD: 'Temel Düzey', BD: 'Başlangıç Düzeyi', OD: 'Orta Düzey', 'İD': 'İleri Düzey',
};
const LEVEL_PROGRESS: Record<LevelCode, { total: number; completed: number }> = {
  TD: { total: 8, completed: 8 }, BD: { total: 12, completed: 7 },
  OD: { total: 15, completed: 3 }, 'İD': { total: 10, completed: 0 },
};

const SKILL_AREAS: { label: string; pct: number }[] = [
  { label: 'Açılış Teorisi', pct: 74 },
  { label: 'Taktik Becerisi', pct: 61 },
  { label: 'Kazanç Konumunu Sonuçlandırma', pct: 45 },
  { label: 'Oyun Sonu Tekniği', pct: 38 },
];

const WEEK_DAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const ACTIVE_WEEK_DAYS = new Set([0, 1, 3, 4, 5]); // madde 4: 5 gün çalıştı

// Zafer'in onayladığı "Sakin Panel" tasarım tuvalinin özel paleti — SADECE bu
// sayfaya sabit uygulanıyor (uygulamanın genelindeki classic/night/neon tema
// seçiminden bağımsız). --t-* değişkenlerini bu <main> köküne ezerek
// tanımlıyoruz; .t-card/.t-btn/.t-muted gibi ortak sınıflar zaten bu
// değişkenleri kullandığı için sayfanın geri kalanı otomatik uyuyor.
const SAKIN_PANEL_PALETTE = {
  '--t-bg': '#F6F2EA',
  '--t-surface': '#FFFFFF',
  '--t-surface-2': '#F1EDE3',
  '--t-border': '#E7DFD2',
  '--t-text-1': '#2B2420',
  '--t-text-2': '#766A5E',
  '--t-accent': '#D97B3F',
  '--t-accent-dk': '#B85F28',
  '--t-accent-fg': '#FFFFFF',
  '--t-ok-bg': '#E3F1E6',
  '--t-ok-bd': '#4C8B5F',
  '--t-ok-text': '#2F5C3D',
  '--t-err-bg': '#FBE4E1',
  '--t-err-bd': '#C24B3F',
  '--t-err-text': '#8F3327',
  '--t-prog-bg': '#E7DFD2',
  '--t-prog-fill': '#D97B3F',
  '--t-glow': 'transparent',
  background: '#F6F2EA',
} as React.CSSProperties;

// Sakin Panel'in kendi madalya renkleri (mevcut turnuva podyum renklerinden
// daha yumuşak/mat) — sadece bu sayfadaki PodiumTile'larda kullanılıyor.
const SAKIN_PANEL_PODIUM = { gold: '#E0A526', silver: '#9AA3AC', bronze: '#C0742F' };

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
    <div className="rounded-xl p-3" style={{ background: 'var(--t-surface-2)' }}>
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const auth = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarId, setAvatarId] = useState('lion');
  const [athleteName, setAthleteName] = useState<string | null>(null);

  const [ratingTempo, setRatingTempo] = useState<TempoKey>('Yıldırım');
  const [statsTempo, setStatsTempo] = useState<TempoKey>('Yıldırım');
  const [tourTempo, setTourTempo] = useState<TempoKey>('Yıldırım');
  const [level, setLevel] = useState<LevelCode>('TD');

  useEffect(() => {
    setAthleteName(getAthleteName());
  }, []);

  function handleLogout() {
    auth.logout();
    router.replace('/');
  }

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/gamification/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setMe(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setAvatarId(getSavedAvatar());
  }, []);

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4" style={SAKIN_PANEL_PALETTE}>
        <div className="t-skel h-32 rounded-2xl" />
        <div className="t-skel h-24 rounded-2xl" />
        <div className="t-skel h-48 rounded-2xl" />
      </main>
    );
  }

  if (!me) {
    return (
      <main className="px-4 pt-8 pb-12 max-w-xl mx-auto text-center space-y-4" style={SAKIN_PANEL_PALETTE}>
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
  const lvl = LEVEL_PROGRESS[level];

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-3" style={SAKIN_PANEL_PALETTE}>

      {/* 1) Kimlik şeridi */}
      <div className="t-card p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl flex-shrink-0" style={{ background: 'var(--t-surface-2)' }}>
          {avatarEmoji(avatarId)}
        </div>
        <div className="min-w-0 flex-1">
          {athleteName && <p className="font-bold text-lg leading-tight truncate">{athleteName}</p>}
          <p className="text-sm t-muted mt-0.5">Bozüyük Satranç Akademisi</p>
        </div>
      </div>

      {/* 2) Performans Puanı */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3">
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

      {/* 3) Genel Maç İstatistikleri — 2. maddeyle AYNI kart tasarımı */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3">
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

      {/* 4) Aktivite/süreklilik göstergesi — haftalık, 7 renkli kutu */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Bu Hafta</span>
          <span className="text-xs font-bold" style={{ color: 'var(--t-accent)' }}>5 gün çalıştı</span>
        </div>
        <div className="flex gap-2">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className="flex-1 text-center">
              <div className="w-full aspect-square rounded-lg" style={{ background: ACTIVE_WEEK_DAYS.has(i) ? 'var(--t-accent)' : 'var(--t-surface-2)' }} />
              <div className="text-[10px] t-muted mt-1">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 5) Ders İlerlemesi — TD/BD/OD/İD, kutucuklar 4. maddeyle AYNI renkte */}
      <div className="t-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide t-muted">Ders İlerlemesi</span>
          <div className="flex gap-1.5">
            {LEVEL_ORDER.map((code) => (
              <button
                key={code} type="button" onClick={() => setLevel(code)} aria-pressed={level === code}
                className="font-mono text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: level === code ? 'var(--t-accent)' : 'var(--t-surface-2)',
                  color: level === code ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
                }}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm font-bold mb-2.5">{LEVEL_NAMES[level]} · {lvl.completed}/{lvl.total} konu tamamlandı</p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(26px, 1fr))' }}>
          {Array.from({ length: lvl.total }, (_, i) => (
            <div key={i} className="aspect-square rounded-md" style={{ background: i < lvl.completed ? 'var(--t-accent)' : 'var(--t-surface-2)' }} />
          ))}
        </div>
      </div>

      {/* 6) Güçlü/Zayıf Yön Analizi — yüzde etiketi çubuğun ucunda */}
      <div className="t-card p-4">
        <span className="text-xs font-bold uppercase tracking-wide t-muted">Güçlü / Zayıf Yön Analizi</span>
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

      {/* 7) Turnuva Geçmişi — 2. maddeyle AYNI kart tasarımı */}
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

      {/* 8) Hoca notu/geri bildirimi */}
      <div className="t-card p-4 flex gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--t-surface-2)' }}>
          <ChatIcon />
        </div>
        <div>
          <p className="text-xs font-bold t-muted mb-0.5">Zafer Hoca&apos;dan not</p>
          <p className="text-sm t-muted italic">Hoca notu eklendiğinde burada görünecek.</p>
        </div>
      </div>

      {/* Ana sayfa + Çıkış (power ikonu) */}
      <button onClick={() => router.push('/home')} className="w-full t-btn py-3 text-base">
        Ana Sayfaya Dön
      </button>
      <div className="flex justify-center pt-1">
        <PowerButton onClick={handleLogout} />
      </div>

    </main>
  );
}
