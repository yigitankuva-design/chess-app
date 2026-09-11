'use client';
import { useState } from 'react';
import { TIME_GROUPS } from '@/lib/play/levels';
import type { MatchStats, TempoStats } from '@/lib/gamification/meApi';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama C / Madde 4, 5, 8): profil sayfasının
 * Performans Puanı / Genel Maç İstatistikleri / Turnuva Geçmişi kartları —
 * artık GERÇEK veri (`/gamification/me/match-stats`, antrenör görünümünde
 * `/teacher/students/{id}/match-stats`). Sporcu (ProfileView) ve antrenör
 * (coach/profile) AYNI kartları kullanır; önceki örnek veriler
 * (RATING_BY_TEMPO vb.) kaldırıldı.
 *
 * Kaynak kuralı (Zafer, S1/S2): sadece "Maç Yap"taki puanlı arkadaş +
 * turnuva maçları; bot ve puansız arkadaş maçları sayılmaz. Veri yoksa
 * kartlar SIFIR gösterir (Zafer: "veriler 0 olarak görünsün").
 */

export type TempoKey = 'Yıldırım' | 'Hızlı' | 'Klasik';
const TEMPO_ORDER: TempoKey[] = ['Yıldırım', 'Hızlı', 'Klasik'];
function tempoEmoji(t: TempoKey): string {
  return TIME_GROUPS.find((g) => g.cat === t)?.emoji ?? '';
}

// Sakin Panel'in kendi madalya renkleri (mevcut turnuva podyum renklerinden
// daha yumuşak/mat) — aktif temadan bağımsız (geleneksel altın/gümüş/bronz).
const SAKIN_PANEL_PODIUM = { gold: '#E0A526', silver: '#9AA3AC', bronze: '#C0742F' };

const EMPTY_TEMPO: TempoStats = {
  rating: { value: 400, games_played: 0, provisional_games: 20, weekly_delta: 0, history: [] },
  stats: { total: 0, wins: 0, draws: 0, losses: 0, win_rate: null, longest_win_streak: 0, best_win_rating: null },
  tournaments: {
    total: 0, games: 0, wins: 0, draws: 0, losses: 0,
    win_rate: null, draw_rate: null, loss_rate: null, first: 0, second: 0, third: 0,
  },
};

function tempoData(data: MatchStats | null, tempo: TempoKey): TempoStats {
  return data?.[tempo] ?? EMPTY_TEMPO;
}

/** null oran (hiç maç yok) → "%0" (Zafer: veriler 0 görünsün). */
function pct(v: number | null): string {
  return `%${v ?? 0}`;
}

export function TempoSelector({ value, onChange }: { value: TempoKey; onChange: (t: TempoKey) => void }) {
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

export function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: 'ok' | 'err' }) {
  const color = tone === 'ok' ? 'var(--t-ok-text)' : tone === 'err' ? 'var(--t-err-text)' : 'var(--t-text-1)';
  return (
    // Madde 2026-09-06 (Görsel 3): kart içeriği ortalanır.
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

/** Son N puanı 100×24'lük viewBox'a yayar (y ekseni ters: yüksek puan üstte).
 *  Tek nokta → düz çizgi; puanlar eşitse ortada düz çizgi. */
export function sparklinePoints(history: number[]): string {
  if (history.length === 0) return '';
  const pts = history.length === 1 ? [history[0], history[0]] : history;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  return pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * 100;
    const y = 22 - ((v - min) / span) * 20; // 2..22 arası
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

/** "▲ 18 bu hafta" / "▼ 5 bu hafta" / "• 0 bu hafta" — son 7 günün farkı. */
export function weeklyDeltaLabel(delta: number): { text: string; color: string } {
  if (delta > 0) return { text: `▲ ${delta} bu hafta`, color: 'var(--t-ok-text)' };
  if (delta < 0) return { text: `▼ ${Math.abs(delta)} bu hafta`, color: 'var(--t-err-text)' };
  return { text: '• 0 bu hafta', color: 'var(--t-text-2)' };
}

function CardHeader({ title, tempo, onTempo }: { title: string; tempo: TempoKey; onTempo: (t: TempoKey) => void }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
      <span className="text-xs font-bold uppercase tracking-wide t-muted">{title}</span>
      <TempoSelector value={tempo} onChange={onTempo} />
    </div>
  );
}

/** Madde 4 — Performans Puanı: güncel puan, haftalık fark, sağlama durumu,
 *  son 10 maç çizgisi. */
export function RatingCard({ data }: { data: MatchStats | null }) {
  const [tempo, setTempo] = useState<TempoKey>('Yıldırım');
  const r = tempoData(data, tempo).rating;
  const delta = weeklyDeltaLabel(r.weekly_delta);
  const settled = r.games_played >= r.provisional_games;
  const caption = settled
    ? `${tempo} tempo · ${r.provisional_games} maçlık sağlama süresi tamamlandı`
    : `${tempo} tempo · ${r.games_played}/${r.provisional_games} maç sağlama`;
  return (
    <div className="t-card p-4">
      <CardHeader title="Performans Puanı" tempo={tempo} onTempo={setTempo} />
      <div className="flex items-baseline gap-2">
        <span className="font-mono tabular-nums text-3xl font-bold">{r.value}</span>
        <span className="text-sm font-bold" style={{ color: delta.color }}>{delta.text}</span>
      </div>
      <p className="text-xs t-muted mb-2">{caption}</p>
      {r.history.length > 0 ? (
        <svg viewBox="0 0 100 24" className="w-full h-6" preserveAspectRatio="none" aria-label="Son maçların puan çizgisi">
          <polyline points={sparklinePoints(r.history)} fill="none" stroke="var(--t-accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <p className="text-xs t-muted text-center py-1">Bu tempoda henüz puanlı maç yok</p>
      )}
    </div>
  );
}

/** Madde 5 — Genel Maç İstatistikleri: toplam / galibiyet oranı / en uzun
 *  galibiyet serisi / en güçlü galibiyet (yenilen rakibin maç öncesi puanı). */
export function MatchStatsCard({ data }: { data: MatchStats | null }) {
  const [tempo, setTempo] = useState<TempoKey>('Yıldırım');
  const s = tempoData(data, tempo).stats;
  return (
    <div className="t-card p-4">
      <CardHeader title="Genel Maç İstatistikleri" tempo={tempo} onTempo={setTempo} />
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Toplam Maç" value={s.total} />
        <StatTile label="Galibiyet Oranı" value={pct(s.win_rate)} tone="ok" />
        <StatTile label="En Uzun Seri" value={`${s.longest_win_streak} galibiyet`} />
        <StatTile label="En Güçlü Galibiyet" value={s.best_win_rating ?? '—'} />
      </div>
    </div>
  );
}

/** Madde 8 — Turnuva Geçmişi: bitmiş turnuvalar; G/B/Y oranları (bay ve
 *  iptal sayılmaz); podyum turnuva sıralamasıyla aynı (çekilen giremez). */
export function TournamentCard({ data }: { data: MatchStats | null }) {
  const [tempo, setTempo] = useState<TempoKey>('Yıldırım');
  const t = tempoData(data, tempo).tournaments;
  return (
    <div className="t-card p-4">
      <CardHeader title="Turnuva Geçmişi" tempo={tempo} onTempo={setTempo} />
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Toplam Turnuva" value={t.total} />
          <StatTile label="Galibiyet Oranı" value={pct(t.win_rate)} tone="ok" />
          <StatTile label="Beraberlik Oranı" value={pct(t.draw_rate)} />
          <StatTile label="Yenilgi Oranı" value={pct(t.loss_rate)} tone="err" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <PodiumTile place={1} count={t.first} color={SAKIN_PANEL_PODIUM.gold} />
          <PodiumTile place={2} count={t.second} color={SAKIN_PANEL_PODIUM.silver} />
          <PodiumTile place={3} count={t.third} color={SAKIN_PANEL_PODIUM.bronze} />
        </div>
      </div>
    </div>
  );
}
