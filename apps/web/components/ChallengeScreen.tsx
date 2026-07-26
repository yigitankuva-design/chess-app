'use client';
import { useState } from 'react';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { resolveColor } from '@/lib/play/color';
import { useLobby } from '@/lib/hooks/use-lobby';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Arkadasa mac daveti akisi (madde b): kriterleri sec -> aktif sporcuyu sec
 *  -> teklif gonder -> kabul edilirse maca gec. */
export function ChallengeScreen({ onMatched }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const lobby = useLobby({ onMatched });

  /** Kriterleri WS'e gonderilecek sade nesneye cevirir (renk burada cozulur). */
  function criteriaPayload(v: MatchCriteriaValue) {
    return {
      color: resolveColor(v.colorChoice),
      skill: v.level.skill,
      depth: v.level.depth,
      tc_label: v.timeControl.label,
      tc_base: v.timeControl.base,
      tc_increment: v.timeControl.increment,
    };
  }

  return (
    <div className="space-y-4">
      {lobby.incoming && (
        <div className="t-ok p-3 space-y-2">
          <p className="text-sm font-semibold">
            {lobby.incoming.from_name} sana maç teklif etti
          </p>
          <div className="flex gap-2">
            <button type="button" className="t-btn px-4 py-2 text-sm"
              onClick={() => lobby.acceptChallenge(lobby.incoming!)}>
              Kabul Et
            </button>
            <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
              onClick={() => lobby.declineChallenge(lobby.incoming!)}>
              Kabul Etme
            </button>
          </div>
        </div>
      )}

      {lobby.notice && <p className="text-sm t-muted text-center">{lobby.notice}</p>}

      {!criteria ? (
        <MatchCriteria startLabel="Teklif Gönder" onStart={setCriteria} />
      ) : waitingFor ? (
        <div className="t-card-i p-5 text-center space-y-2">
          <p className="text-3xl">⏳</p>
          <p className="font-bold text-sm">{waitingFor} bekleniyor…</p>
          <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
            onClick={() => setWaitingFor(null)}>
            Vazgeç
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold t-muted uppercase tracking-wide">
            Aktif sporcular — teklif göndermek için birine dokun
          </p>
          {lobby.players.length === 0 ? (
            <p className="text-sm t-muted">Şu an aktif sporcu yok. Biraz sonra tekrar dene.</p>
          ) : (
            lobby.players.map((p) => (
              <button
                key={p.child_id}
                type="button"
                onClick={() => {
                  lobby.challenge(p.child_id, criteriaPayload(criteria));
                  setWaitingFor(p.display_name);
                }}
                className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-xl">🧒</span>
                <span className="font-medium text-sm flex-1">{p.display_name}</span>
                <span className="text-xs t-muted">Teklif et →</span>
              </button>
            ))
          )}
          <button type="button" className="t-btn-ghost px-4 py-2 text-xs"
            onClick={() => setCriteria(null)}>
            ← Kriterleri değiştir
          </button>
        </div>
      )}
    </div>
  );
}
