'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  listTournaments, getTournament, joinTournament, startPairingGame,
  createTournament, startTournament, advanceTournamentRound, deleteTournament,
} from '@/lib/tournamentsApi';
import type { TournamentSummary, TournamentDetail } from '@/lib/tournamentsApi';
import { formatPlayerLabel } from '@/lib/play/titles';
import type { TimeControl } from '@/components/BotGame';
import { useSettings } from '@/lib/settings/settings-context';

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

/** "Turnuvaya Katıl" — sporcu tarafı. Madde 2026-09-05: turnuva oluşturma/
 *  başlatma/tur ilerletme artık admin'de DEĞİL, doğrudan burada — sporcular
 *  kendi aralarında (aynı hocaya bağlı olanlar birbirini görür) turnuva
 *  kurup yönetebiliyor. Maç, YENİ bir arayüz DEĞİL, mevcut /play/online/{gameId}
 *  (LiveGame) ekranında oynanır. */
export function TournamentPlay() {
  const router = useRouter();
  const { settings } = useSettings();
  const timeGroups = settings.play.timeGroups;
  const tournamentDefaults = settings.play.tournamentDefaults;
  const [list, setList] = useState<TournamentSummary[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState(String(tournamentDefaults.roundsTotal));
  const [tc, setTc] = useState<TimeControl | null>(null);
  const [rated, setRated] = useState(tournamentDefaults.rated);

  /** Oluşturma formu açılınca, admin'in belirlediği varsayılan süre önceden
   *  seçili gelsin (tur sayısı/puanlı-puansız zaten useState başlangıcında
   *  ayarlandı — süre listesi async yüklendiği için burada ayrıca eşleştirilir). */
  function openCreateForm() {
    setRounds(String(tournamentDefaults.roundsTotal));
    setRated(tournamentDefaults.rated);
    const defaultTc = timeGroups.flatMap((g) => g.items).find((i) => i.label === tournamentDefaults.timeControlLabel);
    setTc(defaultTc ?? null);
    setShowCreate(true);
  }

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

  async function create() {
    if (name.trim().length < 1 || !tc) return;
    const roundsNum = Number(rounds);
    if (!Number.isInteger(roundsNum) || roundsNum < 1) { setMsg('Tur sayısı 1 veya daha büyük olmalı'); return; }
    setBusy(true); setMsg(null);
    const created = await createTournament({
      name: name.trim(), rounds_total: roundsNum,
      base_ms: tc.base * 1000, increment_ms: tc.increment * 1000,
      rated,
    });
    setBusy(false);
    if (!created) { setMsg('Turnuva oluşturulamadı'); return; }
    setName(''); setRounds('4'); setTc(null); setRated(true); setShowCreate(false);
    await refreshList();
    setOpenId(created.id);
  }

  async function startMatch(pairingId: number) {
    if (openId === null) return;
    setBusy(true); setMsg(null);
    const res = await startPairingGame(openId, pairingId);
    setBusy(false);
    if (!res) { setMsg('Maç başlatılamadı.'); return; }
    router.push(`/play/online/${res.game_id}?color=${res.color}`);
  }

  async function doStart() {
    if (openId === null) return;
    setBusy(true); setMsg(null);
    const res = await startTournament(openId);
    setBusy(false);
    if (!res) { setMsg('Turnuva başlatılamadı.'); return; }
    setDetail(res);
  }

  async function doNextRound() {
    if (openId === null) return;
    setBusy(true); setMsg(null);
    const res = await advanceTournamentRound(openId);
    setBusy(false);
    if (!res) { setMsg('Tur ilerletilemedi.'); return; }
    setDetail(res);
  }

  async function doDelete() {
    if (openId === null) return;
    setBusy(true); setMsg(null);
    const ok = await deleteTournament(openId);
    setBusy(false);
    if (!ok) { setMsg('Silinemedi.'); return; }
    setOpenId(null); setDetail(null);
    await refreshList();
  }

  // ── Turnuva detayı ──────────────────────────────────────────────────────
  if (openId !== null) {
    const currentRoundPairings = detail?.current_round != null
      ? detail.pairings_by_round?.[String(detail.current_round)] ?? []
      : [];
    const currentRoundDone = currentRoundPairings.length > 0 && currentRoundPairings.every((p) => p.result);

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
                {detail.rated && <> · 🏆 Puanlı</>}
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
              <div className="t-card-i p-4 space-y-2">
                <p className="text-sm t-muted">
                  {detail.standings.length} sporcu katıldı — turnuvayı en az 2 katılımcıyla başlatabilirsin.
                </p>
                <button type="button" disabled={busy || detail.standings.length < 2} onClick={doStart}
                  className="t-btn px-4 py-2.5 text-sm w-full">
                  Turnuvayı Başlat
                </button>
              </div>
            )}

            {detail.status === 'active' && (
              <div className="t-card-i p-4 space-y-2">
                <p className="text-sm t-muted">
                  {currentRoundDone
                    ? 'Bu turun tüm eşleşmeleri sonuçlandı.'
                    : `${currentRoundPairings.filter((p) => !p.result).length} eşleşme bekleniyor.`}
                </p>
                <button type="button" disabled={busy || !currentRoundDone} onClick={doNextRound}
                  className="t-btn px-4 py-2.5 text-sm w-full">
                  {detail.current_round === detail.rounds_total ? 'Turnuvayı Bitir' : 'Sonraki Tur'}
                </button>
              </div>
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
                      <span className="flex-1">{formatPlayerLabel(row.display_name, row.rating, row.title)}</span>
                      <span className="font-semibold">{row.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="button" disabled={busy} onClick={doDelete}
              className="t-btn-ghost text-xs px-3 py-1.5" style={{ color: '#f87171' }}>
              Turnuvayı Sil
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Turnuva listesi ─────────────────────────────────────────────────────
  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent)' : '1px solid var(--t-border)',
    background: active
      ? 'color-mix(in srgb, var(--t-accent) 12%, transparent)'
      : 'var(--t-surface)',
    color: active ? 'var(--t-accent)' : 'var(--t-text)',
  });

  return (
    <div className="space-y-3">
      {!showCreate ? (
        <button type="button" onClick={openCreateForm}
          className="t-btn px-4 py-2.5 text-sm w-full">
          + Turnuva Oluştur
        </button>
      ) : (
        <div className="t-card-i p-4 space-y-3">
          <p className="font-bold text-sm">Yeni turnuva oluştur</p>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Turnuva adı (örn. Yaz Turnuvası)"
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)' }} />
          <div>
            <label className="text-xs t-muted block mb-1">Tur sayısı</label>
            <input type="number" min={1} value={rounds} onChange={(e) => setRounds(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text)' }} />
          </div>
          <div className="space-y-3">
            <p className="text-xs t-muted uppercase tracking-wide">Tempo ve Süre</p>
            {timeGroups.map((g) => (
              <div key={g.cat} className="space-y-1.5">
                <p className="text-xs t-muted flex items-center gap-1.5">
                  <span>{g.emoji}</span> {g.cat}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((item) => (
                    <button key={item.label} type="button" onClick={() => setTc(item)}
                      className="py-2.5 rounded-lg text-sm font-bold transition-all"
                      style={pill(tc?.label === item.label)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs t-muted uppercase tracking-wide mb-1.5">Oyun Modu</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRated(true)}
                className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(rated)}>
                🏆 Puanlı
              </button>
              <button type="button" onClick={() => setRated(false)}
                className="py-2.5 rounded-lg text-sm font-bold transition-all" style={pill(!rated)}>
                Puansız
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={create} disabled={busy || name.trim().length < 1 || !tc}
              className="t-btn px-4 py-2.5 text-sm flex-1">
              {busy ? 'Oluşturuluyor...' : 'Turnuva oluştur'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="t-btn-ghost px-4 py-2.5 text-sm">
              Vazgeç
            </button>
          </div>
        </div>
      )}

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
                {t.rated && <> · 🏆 Puanlı</>}
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
