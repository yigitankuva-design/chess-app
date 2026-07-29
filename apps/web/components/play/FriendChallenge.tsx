'use client';
import { useEffect, useState } from 'react';
import { StepCard } from '@/components/play/StepCard';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';
import { filterAthletes, mergeOnline } from '@/lib/play/athleteFilter';
import type { Athlete, AthleteRow } from '@/lib/play/athleteFilter';
import { resolveColor } from '@/lib/play/color';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type StepKey = 'opening' | 'criteria' | 'friend';

/** Kriterleri WS'e gonderilecek sade nesneye cevirir (renk burada cozulur).
 *  ChallengeScreen'den TASINDI — alan adlari sunucudaki
 *  _handle_challenge_accept ile eslesmek zorunda, degistirilmez. */
function criteriaPayload(v: MatchCriteriaValue, startFen?: string | null) {
  return {
    color: resolveColor(v.colorChoice),
    skill: v.level.skill,
    depth: v.level.depth,
    tc_label: v.timeControl.label,
    tc_base: v.timeControl.base,
    tc_increment: v.timeControl.increment,
    // Acilis pratiginden gelindiyse tahta o konumdan baslar.
    start_fen: startFen ?? null,
  };
}

interface Props {
  /** Acilis pratiginden gelindiyse 1. adim olarak acilis secimi gosterilir.
   *  Verilmezse (Arkadasla Oyna gibi duz akislar) o adim HIC cizilmez. */
  openingStep?: {
    render: (onPicked: () => void) => React.ReactNode;
    summary: string | null;
    picked: boolean;
    startFen: string | null;
  };
}

/** Arkadasa karsi pratik. Madde 6 sirasi:
 *  1) Acilis Konumu Sec  2) Mac Kriterlerini Belirle  3) Arkadasini Sec */
export function FriendChallenge({ openingStep }: Props = {}) {
  const { players, challenge } = useLobbyContext();
  const [open, setOpen] = useState<StepKey | null>(
    openingStep ? 'opening' : 'criteria',
  );
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [all, setAll] = useState<Athlete[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AthleteRow | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  // Sporcu listesi bir kez yuklenir; aktiflik lobi soketinden ayrica gelir.
  useEffect(() => {
    const token = getToken();
    if (!token) { setAll([]); return; }
    let alive = true;
    fetch(`${API_BASE}/athletes`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('yuklenemedi'))))
      .then((d) => { if (alive) setAll(Array.isArray(d) ? d : []); })
      .catch(() => { if (alive) { setAll([]); setLoadError(true); } });
    return () => { alive = false; };
  }, []);

  const rows = mergeOnline(all ?? [], players.map((p) => p.child_id));
  const shown = filterAthletes(rows, query);

  function sendChallenge() {
    if (!criteria || !selected || !selected.online) return;
    challenge(selected.child_id, criteriaPayload(criteria, openingStep?.startFen));
    setWaitingFor(selected.display_name);
  }

  /** Adim numaralari acilis adimi varsa 1 kayar. */
  const n = (base: 1 | 2) => (openingStep ? base + 1 : base);
  const criteriaLocked = openingStep ? !openingStep.picked : false;

  if (waitingFor) {
    return (
      <div className="t-card-i p-5 text-center space-y-2">
        <p className="text-3xl">⏳</p>
        <p className="font-bold text-sm">{waitingFor} bekleniyor…</p>
        <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
          onClick={() => setWaitingFor(null)}>
          Vazgeç
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {openingStep && (
        <StepCard
          stepNumber={1}
          title="Açılış Konumunu Seç"
          summary={openingStep.summary}
          open={open === 'opening'}
          onToggle={() => setOpen((p) => (p === 'opening' ? null : 'opening'))}
        >
          {openingStep.render(() => setOpen('criteria'))}
        </StepCard>
      )}

      <StepCard
        stepNumber={n(1)}
        title="Maç Kriterlerini Belirle"
        summary={criteria ? `✓ ${criteria.timeControl.label}` : null}
        open={open === 'criteria'}
        locked={criteriaLocked}
        onToggle={() => setOpen((p) => (p === 'criteria' ? null : 'criteria'))}
      >
        {/* Madde 7: insana karsi DUZEY anlamsiz — sadece Tempo-Sure-Renk. */}
        <MatchCriteria
          showLevel={false}
          startLabel="Kriterleri Onayla"
          onStart={(v) => { setCriteria(v); setOpen('friend'); }}
        />
      </StepCard>

      <StepCard
        stepNumber={n(2)}
        title="Arkadaşını Seç"
        summary={selected ? `✓ ${selected.display_name}` : null}
        open={open === 'friend'}
        locked={criteria === null}
        onToggle={() => setOpen((p) => (p === 'friend' ? null : 'friend'))}
      >
        <div className="space-y-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 ARA — arkadaşının adını yaz"
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{
              border: '1px solid var(--t-border)',
              background: 'var(--t-surface)',
              color: 'var(--t-text)',
            }}
          />

          {loadError && (
            <p className="text-sm t-muted">Sporcu listesi yüklenemedi.</p>
          )}
          {!loadError && all !== null && rows.length === 0 && (
            <p className="text-sm t-muted">Listede sporcu yok.</p>
          )}
          {!loadError && all !== null && rows.length > 0 && shown.length === 0 && (
            <p className="text-sm t-muted">Bu ada uyan arkadaş yok.</p>
          )}

          <div className="space-y-2">
            {shown.map((r) => {
              const isSel = selected?.child_id === r.child_id;
              return (
                <button
                  key={r.child_id}
                  type="button"
                  aria-disabled={!r.online}
                  onClick={() => { if (r.online) setSelected(r); }}
                  className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{
                    opacity: r.online ? 1 : 0.5,
                    border: isSel ? '2px solid var(--t-accent)' : undefined,
                  }}
                >
                  <span className="text-sm">{r.online ? '🟢' : '⚪'}</span>
                  <span className="font-medium text-sm flex-1">{r.display_name}</span>
                  {!r.online && <span className="text-xs t-muted">çevrimdışı</span>}
                  {isSel && (
                    <span className="text-xs" style={{ color: 'var(--t-accent)' }}>seçili</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={sendChallenge}
            disabled={!selected || !selected.online}
            className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--t-accent)', color: '#fff' }}
          >
            ▶️ Teklif Et
          </button>
        </div>
      </StepCard>
    </div>
  );
}
