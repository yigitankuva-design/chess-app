'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTournament, joinTournament, deleteTournament } from '@/lib/tournamentsApi';
import type { TournamentDetail } from '@/lib/tournamentsApi';
import { formatPlayerLabel } from '@/lib/play/titles';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { getToken } from '@/lib/auth-storage';

const STATUS_LABEL: Record<TournamentDetail['status'], string> = {
  upcoming: 'Başlamadı',
  active: 'Devam ediyor',
  finished: 'Bitti',
};

function tempoLabel(baseMs: number | null, incrementMs: number | null): string {
  if (baseMs == null) return 'Süresiz';
  const min = Math.round(baseMs / 60000);
  const inc = incrementMs ? Math.round(incrementMs / 1000) : 0;
  return `${min}+${inc}`;
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Ayrı, düz prop alan bileşen — `use(params)`'tan bağımsız birim test
 *  edilebilsin diye (bkz. play/online/[gameId]/page.tsx'teki
 *  LiveGameContent/LiveGame ayrımıyla AYNI desen). */
export function TournamentDetailView({ tournamentId }: { tournamentId: number }) {
  const router = useRouter();

  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<'idle' | 'connecting' | 'waiting' | 'timeout'>('idle');
  const [retryKey, setRetryKey] = useState(0);

  const refresh = useCallback(async () => {
    const d = await getTournament(tournamentId);
    setDetail(d);
    if (d) setSecondsLeft(d.seconds_remaining);
  }, [tournamentId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Sunucuyla periyodik yeniden senkron — geri sayım arada yerelde saniyede bir azalır.
  useEffect(() => {
    if (!detail || detail.status === 'finished') return;
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [detail, refresh]);

  useEffect(() => {
    if (!detail || detail.status !== 'active') return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [detail]);

  const canQueue = !!detail && detail.joined && detail.status === 'active' && !detail.my_pairing;
  const token = typeof window !== 'undefined' ? getToken() : null;
  const wsUrl = canQueue && token
    ? `${wsBase()}/ws/tournament/${tournamentId}/queue?token=${encodeURIComponent(token)}&_r=${retryKey}`
    : null;

  useWebSocket(wsUrl, (data: unknown) => {
    const m = data as { type?: string; game_id?: number; color?: string };
    if (m?.type === 'waiting') setQueueStatus('waiting');
    else if (m?.type === 'matched' && m.game_id != null) {
      router.push(`/play/online/${m.game_id}?color=${m.color}`);
    } else if (m?.type === 'timeout') setQueueStatus('timeout');
  });

  useEffect(() => {
    setQueueStatus(wsUrl ? 'connecting' : 'idle');
  }, [wsUrl]);

  async function join() {
    setBusy(true); setMsg(null);
    const ok = await joinTournament(tournamentId);
    setBusy(false);
    if (!ok) { setMsg('Katılamadın, tekrar dene.'); return; }
    await refresh();
  }

  async function remove() {
    setBusy(true); setMsg(null);
    const ok = await deleteTournament(tournamentId);
    setBusy(false);
    if (!ok) { setMsg('Silinemedi.'); return; }
    router.push('/play/tournament/lobby');
  }

  if (!detail) {
    return (
      <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto">
        <p className="text-sm t-muted">Yükleniyor...</p>
      </main>
    );
  }

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-4">
      <div className="t-card-i p-4 space-y-1">
        <p className="font-bold text-sm">🏆 {detail.name}</p>
        <p className="text-xs t-muted">
          {STATUS_LABEL[detail.status]} · {detail.duration_minutes} dk · {tempoLabel(detail.base_ms, detail.increment_ms)}
          {detail.rated && <> · 🏆 Puanlı</>}
        </p>
        {detail.status === 'active' && (
          <p className="text-2xl font-bold" style={{ color: 'var(--t-accent)' }}>{formatCountdown(secondsLeft)}</p>
        )}
        {detail.status === 'upcoming' && (
          <p className="text-sm t-muted">
            {new Date(detail.starts_at).toLocaleString('tr-TR')} tarihinde başlayacak.
          </p>
        )}
      </div>

      {!detail.joined && detail.status !== 'finished' && (
        <button type="button" disabled={busy} onClick={join} className="t-btn px-4 py-2.5 text-sm w-full">
          {busy ? 'Katılıyor...' : 'Turnuvaya Katıl'}
        </button>
      )}

      {detail.joined && detail.status === 'active' && (
        detail.my_pairing ? (
          <div className="t-card-i p-4 space-y-2">
            <p className="text-sm">
              Rakibin: <span className="font-semibold">{detail.my_pairing.opponent_name ?? 'Sporcu'}</span>{' '}
              ({detail.my_pairing.my_color === 'white' ? 'Beyaz' : 'Siyah'} oynuyorsun)
            </p>
            <button type="button"
              onClick={() => router.push(`/play/online/${detail.my_pairing!.game_id}?color=${detail.my_pairing!.my_color}`)}
              className="t-btn px-4 py-2.5 text-sm w-full">
              Maça Devam Et
            </button>
          </div>
        ) : (
          <div className="t-card-i p-4 text-center space-y-2">
            {queueStatus === 'timeout' ? (
              <>
                <p className="text-sm t-muted">Şu an rakip yok.</p>
                <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="t-btn-ghost px-4 py-2 text-sm">
                  Tekrar Dene
                </button>
              </>
            ) : (
              <>
                <div className="text-3xl animate-pulse">⏳</div>
                <p className="text-sm t-muted">Rakip aranıyor...</p>
              </>
            )}
          </div>
        )
      )}

      {msg && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}

      <div className="t-card-i p-4">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide mb-2">Sıralama</p>
        {detail.standings.length === 0 ? (
          <p className="text-sm t-muted">Henüz katılımcı yok.</p>
        ) : (
          <div className="space-y-1.5">
            {detail.standings.map((row, i) => (
              <div key={row.child_id} className="flex items-center gap-3 text-sm">
                <span className="t-muted w-5 text-right">{i + 1}.</span>
                <span className="flex-1">
                  {formatPlayerLabel(row.display_name ?? 'Sporcu', row.rating, row.title)}
                  {detail.winning_streak_bonus && row.streak >= 2 && <> 🔥</>}
                </span>
                <span className="t-muted text-xs w-10 text-right">{row.sb.toFixed(1)}</span>
                <span className="font-semibold w-8 text-right">{row.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" disabled={busy} onClick={remove}
        className="t-btn-ghost text-xs px-3 py-1.5" style={{ color: '#f87171' }}>
        Turnuvayı Sil
      </button>
    </main>
  );
}
