'use client';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';

/** Gelen mac teklifi seridi. Layout'ta durur, bu yuzden sporcu HANGI sayfada
 *  olursa olsun teklifi gorur. Teklif yoksa hicbir sey cizmez. */
export function IncomingChallengeBanner() {
  const { incoming, acceptChallenge, declineChallenge } = useLobbyContext();
  if (!incoming) return null;

  // criteria serbest bicimli geldigi icin TIP KONTROLUYLE okunur; alan yoksa
  // etiket hic gosterilmez (uydurulmaz — KURAL #1).
  const tc = typeof incoming.criteria.tc_label === 'string'
    ? incoming.criteria.tc_label
    : null;

  return (
    <div className="t-ok mx-4 mt-3 p-3 flex items-center gap-2 flex-wrap">
      <p className="text-sm font-semibold flex-1 min-w-0">
        🤝 {incoming.from_name} sana maç teklif etti{tc ? ` — ${tc}` : ''}
      </p>
      <button type="button" className="t-btn px-4 py-2 text-sm"
        onClick={() => acceptChallenge(incoming)}>
        Evet
      </button>
      <button type="button" className="t-btn-ghost px-4 py-2 text-sm"
        onClick={() => declineChallenge(incoming)}>
        Hayır
      </button>
    </div>
  );
}
