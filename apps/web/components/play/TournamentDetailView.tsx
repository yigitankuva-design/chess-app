'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTournament, joinTournament, leaveTournament, deleteTournament } from '@/lib/tournamentsApi';
import type { TournamentDetail, TournamentStandingRow } from '@/lib/tournamentsApi';
import { formatPlayerLabel } from '@/lib/play/titles';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { getToken } from '@/lib/auth-storage';

/** Madde 2026-09-09 (6): turnuva bitince ilk 3'ün bilgilerini gösteren podyum
 *  bildirimi — Zafer'in gönderdiği görsele göre (madalya renkleri, "N."
 *  rozeti, Performans/Oynanmış oyunlar/Kazanma oranı). */
const PODIUM_STYLE: Record<number, { medal: string; size: number; color: string }> = {
  0: { medal: '🥇', size: 64, color: '#facc15' },
  1: { medal: '🥈', size: 52, color: '#cbd5e1' },
  2: { medal: '🥉', size: 52, color: '#fb923c' },
};
// Podyumda 1. ortada, 2. solda, 3. sağda görünsün (görseldeki yerleşim).
const PODIUM_ORDER = [1, 0, 2];

function TournamentFinishedModal({ name, top3, onClose }: {
  name: string; top3: TournamentStandingRow[]; onClose: () => void;
}) {
  return (
    <div
      role="dialog" aria-label="Turnuva tamamlandı"
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="t-card-i"
        style={{ maxWidth: 480, width: '100%', padding: '1.5rem', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-bold text-lg" style={{ marginBottom: '1.25rem' }}>
          {name} Tamamlanmıştır.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.75rem' }}>
          {PODIUM_ORDER.filter((i) => top3[i]).map((i) => {
            const row = top3[i];
            const style = PODIUM_STYLE[i];
            return (
              <div key={row.child_id} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: style.size, lineHeight: 1 }} aria-hidden="true">{style.medal}</div>
                <p className="text-xs font-bold" style={{ color: style.color }}>{i + 1}.</p>
                <p className="font-semibold text-sm truncate">
                  {formatPlayerLabel(row.display_name ?? 'Sporcu', row.rating, row.title)}
                </p>
                <p className="text-xs t-muted" style={{ marginTop: '0.4rem' }}>
                  Performans {row.rating ?? '—'}
                </p>
                <p className="text-xs t-muted">Oynanmış oyunlar {row.games_played}</p>
                <p className="text-xs t-muted">
                  Kazanma oranı {row.win_rate != null ? `${row.win_rate}%` : '—'}
                </p>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={onClose} className="t-btn px-4 py-2 text-sm w-full"
          style={{ marginTop: '1.25rem' }}>
          Kapat
        </button>
      </div>
    </div>
  );
}

/** Madde 2026-09-09 (5): sıralama tablosu sayfalanır — Zafer'in gönderdiği
 *  görseldeki footer'da "1/10 - 256 Kişi" örneği bunu gösteriyor. */
const STANDINGS_PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  /** Madde 2026-09-09 (6): bildirim SADECE geçişte (active/upcoming ->
   *  finished) gösterilsin — sayfaya SONRADAN gelen (zaten bitmiş turnuvayı
   *  ilk kez açan) sporcuya otomatik açılmasın. */
  const prevStatusRef = useRef<TournamentDetail['status'] | null>(null);

  const refresh = useCallback(async () => {
    const d = await getTournament(tournamentId);
    setDetail(d);
    if (d) setSecondsLeft(d.seconds_remaining);
  }, [tournamentId]);

  useEffect(() => {
    if (!detail) return;
    if (prevStatusRef.current && prevStatusRef.current !== 'finished' && detail.status === 'finished') {
      setShowFinishedModal(true);
    }
    prevStatusRef.current = detail.status;
  }, [detail]);

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
      router.push(`/play/online/${m.game_id}?color=${m.color}&tournamentId=${tournamentId}`);
    } else if (m?.type === 'timeout') setQueueStatus('timeout');
  });

  useEffect(() => {
    setQueueStatus(wsUrl ? 'connecting' : 'idle');
  }, [wsUrl]);

  // Sayfa numarası, katılımcı listesi her yenilendiğinde (ör. biri turnuvadan
  // çıkınca sayfa sayısı azalabilir) geçerli aralığa sığdırılır.
  useEffect(() => { setPage(1); }, [tournamentId]);

  async function join() {
    setBusy(true); setMsg(null);
    const ok = await joinTournament(tournamentId);
    setBusy(false);
    if (!ok) { setMsg('Katılamadın, tekrar dene.'); return; }
    await refresh();
  }

  async function leave() {
    setBusy(true); setMsg(null);
    const ok = await leaveTournament(tournamentId);
    setBusy(false);
    if (!ok) { setMsg('Çıkış yapılamadı, tekrar dene.'); return; }
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

  const totalPages = Math.max(1, Math.ceil(detail.standings.length / STANDINGS_PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageRows = detail.standings.slice(
    (activePage - 1) * STANDINGS_PAGE_SIZE, activePage * STANDINGS_PAGE_SIZE,
  );

  /** Üst şeritteki tek satırlık durum mesajı — Zafer'in görseldeki
   *  "Hazır Ol! Eşleşme Yapılıyor" örneğiyle AYNI dil. */
  function statusText(): string {
    if (detail!.status === 'finished') return 'Turnuva sona erdi.';
    if (!detail!.joined) {
      return detail!.status === 'upcoming'
        ? `${new Date(detail!.starts_at).toLocaleString('tr-TR')} tarihinde başlayacak.`
        : 'Turnuva devam ediyor, katılabilirsin.';
    }
    if (detail!.status === 'upcoming') return 'Turnuva başlayınca eşleşme yapılacak.';
    if (detail!.my_pairing) return `${detail!.my_pairing.opponent_name ?? 'Sporcu'} ile maçın sürüyor.`;
    if (queueStatus === 'timeout') return 'Şu an rakip yok.';
    return 'Hazır Ol! Eşleşme Yapılıyor';
  }

  const remainingLabel = detail.status === 'active' ? formatCountdown(secondsLeft)
    : detail.status === 'upcoming' ? '--:--' : '0:00';

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-lg mx-auto space-y-3">
      <div className="t-card-i overflow-hidden">
        {/* Madde 2026-09-09 (5), görsel satır 1: Turnuva İsmi + Katılım Durumu.
            Sporcu katılınca "KATIL" yerine "ÇEKİL" görünür, istediği an çıkabilir. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--t-border)' }}>
          <p className="font-bold text-base truncate">🏆 {detail.name}</p>
          {detail.joined ? (
            <button type="button" disabled={busy} onClick={leave}
              className="px-4 py-2 rounded-md text-xs font-bold disabled:opacity-50 flex-shrink-0"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
              {busy ? '...' : 'ÇEKİL'}
            </button>
          ) : detail.status !== 'finished' ? (
            <button type="button" disabled={busy} onClick={join}
              className="px-4 py-2 rounded-md text-xs font-bold disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--t-accent)', color: '#fff' }}>
              {busy ? '...' : 'KATIL'}
            </button>
          ) : null}
        </div>

        {/* Görsel satır 2: durum şeridi ("Hazır Ol! Eşleşme Yapılıyor" vb.). */}
        <div className="px-4 py-2.5 text-center text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', borderBottom: '1px solid var(--t-border)' }}>
          {(queueStatus === 'connecting' || queueStatus === 'waiting') && (
            <span className="inline-block mr-1.5 animate-pulse">⏳</span>
          )}
          {statusText()}
        </div>

        {detail.joined && detail.status === 'active' && (
          detail.my_pairing ? (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <button type="button"
                onClick={() => router.push(
                  `/play/online/${detail.my_pairing!.game_id}?color=${detail.my_pairing!.my_color}&tournamentId=${tournamentId}`,
                )}
                className="t-btn px-4 py-2.5 text-sm w-full">
                Maça Devam Et
              </button>
            </div>
          ) : queueStatus === 'timeout' ? (
            <div className="px-4 py-3 text-center" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <button type="button" onClick={() => setRetryKey((k) => k + 1)} className="t-btn-ghost px-4 py-2 text-sm">
                Tekrar Dene
              </button>
            </div>
          ) : null
        )}

        {msg && <p className="px-4 py-2 text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}

        {/* Görsel satır 3-4: Sıra / İsim / Puan tablosu. */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="pl-4 pr-2 py-2 text-xs italic font-semibold t-muted text-left w-12">Sıra</th>
                <th className="px-2 py-2 text-xs italic font-semibold t-muted text-left">İsim</th>
                <th className="px-2 pr-4 py-2 text-xs italic font-semibold t-muted text-right w-16">Puan</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-5 text-center text-sm t-muted">Henüz katılımcı yok.</td></tr>
              ) : pageRows.map((row, i) => (
                <tr key={row.child_id} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined }}>
                  <td className="pl-4 pr-2 py-2 t-muted">{(activePage - 1) * STANDINGS_PAGE_SIZE + i + 1}</td>
                  <td className="px-2 py-2">
                    {formatPlayerLabel(row.display_name ?? 'Sporcu', row.rating, row.title)}
                    {detail.winning_streak_bonus && row.streak >= 2 && <> 🔥</>}
                  </td>
                  <td className="px-2 pr-4 py-2 text-right font-semibold">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Görsel satır 5: Kalan Süre · Sayfa/Toplam Kişi · İleri-Geri Gitme. */}
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid var(--t-border)' }}>
          <div className="px-3 py-1.5 rounded-md text-xs font-bold text-center t-muted"
            style={{ border: '1px solid var(--t-border)' }}>
            {remainingLabel}
          </div>
          <div className="flex-1 px-3 py-1.5 rounded-md text-xs font-semibold text-center"
            style={{ border: '1px solid var(--t-border)' }}>
            {activePage}/{totalPages} - {detail.participant_count} Kişi
          </div>
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-md"
            style={{ border: '1px solid var(--t-border)' }}>
            <button type="button" aria-label="İlk sayfa" disabled={activePage === 1}
              onClick={() => setPage(1)}
              className="px-1.5 py-1 text-sm disabled:opacity-30">⏮</button>
            <button type="button" aria-label="Önceki sayfa" disabled={activePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-1.5 py-1 text-sm disabled:opacity-30">◀</button>
            <button type="button" aria-label="Sonraki sayfa" disabled={activePage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-1.5 py-1 text-sm disabled:opacity-30">▶</button>
            <button type="button" aria-label="Son sayfa" disabled={activePage === totalPages}
              onClick={() => setPage(totalPages)}
              className="px-1.5 py-1 text-sm disabled:opacity-30">⏭</button>
          </div>
        </div>
      </div>

      {/* Madde 2026-09-09 (4): SADECE oluşturan VE SADECE henüz başlamadıysa. */}
      {detail.can_delete && (
        <button type="button" disabled={busy} onClick={remove}
          className="t-btn-ghost text-xs px-3 py-1.5" style={{ color: '#f87171' }}>
          Turnuvayı Sil
        </button>
      )}

      {showFinishedModal && (
        <TournamentFinishedModal
          name={detail.name}
          top3={detail.standings.slice(0, 3)}
          onClose={() => setShowFinishedModal(false)}
        />
      )}
    </main>
  );
}
