import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  RatingCard, MatchStatsCard, TournamentCard, sparklinePoints, weeklyDeltaLabel,
} from '@/components/profile/MatchStatsCards';
import type { MatchStats, TempoStats } from '@/lib/gamification/meApi';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama C / Madde 4, 5, 8): Performans Puanı /
 * Genel Maç İstatistikleri / Turnuva Geçmişi kartları gerçek veriyle.
 */
const EMPTY: TempoStats = {
  rating: { value: 400, games_played: 0, provisional_games: 20, weekly_delta: 0, history: [] },
  stats: { total: 0, wins: 0, draws: 0, losses: 0, win_rate: null, longest_win_streak: 0, best_win_rating: null },
  tournaments: {
    total: 0, games: 0, wins: 0, draws: 0, losses: 0,
    win_rate: null, draw_rate: null, loss_rate: null, first: 0, second: 0, third: 0,
  },
};
const FULL: MatchStats = {
  'Yıldırım': {
    rating: { value: 1042, games_played: 23, provisional_games: 20, weekly_delta: 18, history: [980, 1000, 1042] },
    stats: { total: 86, wins: 52, draws: 10, losses: 24, win_rate: 61, longest_win_streak: 6, best_win_rating: 1180 },
    tournaments: {
      total: 22, games: 100, wins: 59, draws: 14, losses: 27,
      win_rate: 59, draw_rate: 14, loss_rate: 27, first: 2, second: 1, third: 3,
    },
  },
  'Hızlı': {
    ...EMPTY,
    rating: { value: 396, games_played: 3, provisional_games: 20, weekly_delta: -4, history: [420, 410, 396] },
  },
  'Klasik': EMPTY,
};

describe('sparklinePoints / weeklyDeltaLabel', () => {
  it('puanları 100×24 kutusuna yayar, yüksek puan üstte (küçük y)', () => {
    const pts = sparklinePoints([400, 500]).split(' ');
    expect(pts).toEqual(['0.0,22.0', '100.0,2.0']);
    expect(sparklinePoints([])).toBe('');
    expect(sparklinePoints([450])).toBe('0.0,22.0 100.0,22.0'); // tek nokta → düz çizgi
  });

  it('haftalık fark etiketi: artı ▲, eksi ▼, sıfır •', () => {
    expect(weeklyDeltaLabel(18).text).toBe('▲ 18 bu hafta');
    expect(weeklyDeltaLabel(-5).text).toBe('▼ 5 bu hafta');
    expect(weeklyDeltaLabel(0).text).toBe('• 0 bu hafta');
  });
});

describe('RatingCard', () => {
  it('veri yokken (null) 400 · 0/20 sağlama ve "henüz puanlı maç yok"', () => {
    render(<RatingCard data={null} />);
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('• 0 bu hafta')).toBeInTheDocument();
    expect(screen.getByText('Yıldırım tempo · 0/20 maç sağlama')).toBeInTheDocument();
    expect(screen.getByText('Bu tempoda henüz puanlı maç yok')).toBeInTheDocument();
  });

  it('gerçek veri: puan, haftalık fark, sağlama tamamlandı, çizgi; tempo değişince Hızlı verisi', () => {
    render(<RatingCard data={FULL} />);
    expect(screen.getByText('1042')).toBeInTheDocument();
    expect(screen.getByText('▲ 18 bu hafta')).toBeInTheDocument();
    expect(screen.getByText('Yıldırım tempo · 20 maçlık sağlama süresi tamamlandı')).toBeInTheDocument();
    expect(screen.getByLabelText('Son maçların puan çizgisi')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hızlı'));
    expect(screen.getByText('396')).toBeInTheDocument();
    expect(screen.getByText('▼ 4 bu hafta')).toBeInTheDocument();
    expect(screen.getByText('Hızlı tempo · 3/20 maç sağlama')).toBeInTheDocument();
  });
});

describe('MatchStatsCard', () => {
  it('veri yokken sıfırlar (%0, 0 galibiyet, en güçlü galibiyet —)', () => {
    render(<MatchStatsCard data={null} />);
    expect(screen.getByText('Toplam Maç').nextSibling).toHaveTextContent('0');
    expect(screen.getByText('%0')).toBeInTheDocument();
    expect(screen.getByText('0 galibiyet')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('gerçek veri Yıldırım; Klasik seçilince sıfır', () => {
    render(<MatchStatsCard data={FULL} />);
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('%61')).toBeInTheDocument();
    expect(screen.getByText('6 galibiyet')).toBeInTheDocument();
    expect(screen.getByText('1180')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Klasik'));
    expect(screen.queryByText('86')).not.toBeInTheDocument();
    expect(screen.getByText('0 galibiyet')).toBeInTheDocument();
  });
});

describe('TournamentCard', () => {
  it('veri yokken hepsi 0 (Zafer: "veriler 0 olarak görünsün")', () => {
    render(<TournamentCard data={null} />);
    expect(screen.getAllByText('%0')).toHaveLength(3);
    expect(screen.getByText('1.lik').previousSibling).toHaveTextContent('0');
  });

  it('gerçek veri: toplam, oranlar, podyum', () => {
    render(<TournamentCard data={FULL} />);
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('%59')).toBeInTheDocument();
    expect(screen.getByText('%14')).toBeInTheDocument();
    expect(screen.getByText('%27')).toBeInTheDocument();
    expect(screen.getByText('1.lik').previousSibling).toHaveTextContent('2');
    expect(screen.getByText('2.lik').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('3.lük').previousSibling).toHaveTextContent('3');
  });
});
