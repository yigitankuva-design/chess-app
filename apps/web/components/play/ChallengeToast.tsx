'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useLobbyContext } from '@/lib/lobby/LobbyContext';

/** Gelen maç teklifi — ekranın SAĞ ÜST köşesinde beliren 3 satırlı kart
 *  (madde 2, 2026-08-20). Layout'ta durur, bu yüzden sporcu HANGİ sayfada
 *  olursa olsun teklifi görür. Teklif yoksa hiçbir şey çizmez. */
export function ChallengeToast() {
  const { incoming, acceptChallenge, declineChallenge } = useLobbyContext();

  // criteria serbest bicimli geldigi icin TIP KONTROLUYLE okunur; alan yoksa
  // etiket hic gosterilmez (uydurulmaz — KURAL #1).
  const tempo = incoming && typeof incoming.criteria.tempo === 'string'
    ? incoming.criteria.tempo
    : null;
  const tc = incoming && typeof incoming.criteria.tc_label === 'string'
    ? incoming.criteria.tc_label
    : null;
  const tempoLine = [tempo, tc].filter(Boolean).join(' · ') || null;

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          className="fixed top-20 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4 shadow-2xl space-y-2"
          style={{ background: 'var(--t-surface)', border: '2px solid var(--t-accent)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--t-accent)' }}>
            ⚔️ Meydan Okuma
          </p>
          <p className="text-lg font-extrabold t-text truncate">{incoming.from_name}</p>
          {tempoLine && <p className="text-sm t-muted">{tempoLine}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" className="t-btn flex-1 py-2 text-sm"
              onClick={() => acceptChallenge(incoming)}>
              Evet
            </button>
            <button type="button" className="t-btn-ghost flex-1 py-2 text-sm"
              onClick={() => declineChallenge(incoming)}>
              Hayır
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
