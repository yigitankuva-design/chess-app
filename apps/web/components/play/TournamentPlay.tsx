'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  listTournaments, getTournament, joinTournament, startPairingGame,
} from '@/lib/tournamentsApi';
import type { TournamentSummary, TournamentDetail } from '@/lib/tournamentsApi';

const STATUS_LABEL: Record<TournamentSummary['status'], string> = {
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

/** "Turnuvaya Katıl" — sporcu tarafı (madde: Admin/hoca oluşturur, İsviçre
 *  usulü basitleştirilmiş eşleştirme, uçtan uca temel akış). Maç, YENİ bir
 *  arayüz DEĞİL, mevcut /play/online/{gameId} (LiveGame) ekranında oynanır. */
export function TournamentPlay() {
  const router = useRouter();
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setList(await listTournaments());
  }, []);

  const refreshDetail = useCallback(async (id: number) => {
    setDetail(await getTournament(id));
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => {
    if (openId === null) return;
    refreshDetail(openId);
  }, [openId, refreshDetail]);

  async function join(id: number) {
    setBusy(true); setMsg(null);
    const ok = await joinTournament(id);
    setBusy(false);
    if (!ok) { setMsg('Katılamadın, tekrar dene.'); return; }
    await refreshList();
    setOpenId(id);
  }

  async function startMatch(pairingId: number) {
    if (openId === null) return;
    setBusy(true); setMsg(null);
    const res = await startPairingGame(openId, pairingId);
    setBusy(false);
    if (!res) { setMsg('Maç başlatılamadı.'); return; }
    router.push(`/play/online/${res.game_id}?color=${res.color}`);
  }

  // ── Turnuva detayı ──────────────────────────────────────────────────────
  if (openId !== null) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => { setOpenId(null); setDetail(null); }}
          className="t-btn-ghost text-xs px-3 py-1.5">
          ← Turnuva listesine dön
        </button>

        {!detail ? (
          <p className="text-sm t-muted">Yükleniyor...</p>
        ) : (
          <>
            <div className="t-card-i p-4 space-y-1">
              <p className="font-bold text-sm">🏆 {detail.name}</p>
              <p className="text-xs t-muted">
                {STATUS_LABEL[detail.status]} · {detail.rounds_total} tur ·{' '}
                {tempoLabel(detail.base_ms, detail.increment_ms)}
                {detail.status === 'active' && detail.current_round !== null && (
                  <> · {detail.current_round}. tur</>
                )}
              </p>
            </div>

            {detail.status === 'active' && detail.my_pairing && (
              <div className="t-card-i p-4 space-y-2">
                <p className="text-xs font-semibold t-muted uppercase tracking-wide">
                  {detail.my_pairing.round_number}. tur eşleşmen
                </p>
                {detail.my_pairing.is_bye ? (
                  <p className="text-sm">🎉 Bu tur bay geçtin, otomatik 1 puan aldın.</p>
                ) : detail.my_pairing.result ? (
                  <p className="text-sm">Bu turu tamamladın ({detail.my_pairing.result}).</p>
                ) : (
                  <>
                    <p className="text-sm">
                      Rakibin: <span className="font-semibold">{detail.my_pairing.opponent_name}</span>{' '}
                      ({detail.my_pairing.my_color === 'white' ? 'Beyaz' : 'Siyah'} oynuyorsun)
                    </p>
                    <button type="button" disabled={busy} onClick={() => startMatch(detail.my_pairing!.id)}
                      className="t-btn px-4 py-2.5 text-sm w-full">
                      {detail.my_pairing.game_id ? 'Maça Devam Et' : 'Maça Başla'}
                    </button>
                  </>
                )}
              </div>
            )}

            {detail.status === 'upcoming' && (
              <p className="text-sm t-muted">Hocan turnuvayı başlattığında eşleşmen burada görünecek.</p>
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
                      <span className="flex-1">{row.display_name}</span>
                      <span className="font-semibold">{row.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Turnuva listesi ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {list === null ? (
        <p className="text-sm t-muted">Yükleniyor...</p>
      ) : list.length === 0 ? (
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">🏆</p>
          <p className="text-sm t-muted">Şu anda katılabileceğin bir turnuva yok.</p>
        </div>
      ) : (
        list.map((t) => (
          <div key={t.id} className="t-card-i p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{t.name}</p>
              <p className="text-xs t-muted mt-0.5">
                {STATUS_LABEL[t.status]} · {t.rounds_total} tur · {tempoLabel(t.base_ms, t.increment_ms)}
              </p>
            </div>
            {t.joined ? (
              <button type="button" onClick={() => setOpenId(t.id)}
                className="t-btn-ghost px-3 py-2 text-xs flex-shrink-0">
                Aç
              </button>
            ) : t.status === 'upcoming' ? (
              <button type="button" disabled={busy} onClick={() => join(t.id)}
                className="t-btn px-3 py-2 text-xs flex-shrink-0">
                Katıl
              </button>
            ) : (
              <span className="text-xs t-muted flex-shrink-0">Katılım kapandı</span>
            )}
          </div>
        ))
      )}
      {msg && <p className="text-sm" style={{ color: 'var(--t-accent)' }}>{msg}</p>}
    </div>
  );
}
