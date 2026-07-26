'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { ChallengeScreen } from '@/components/ChallengeScreen';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';
import type { MatchedInfo } from '@/lib/hooks/use-lobby';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }
type Opponent = 'bot' | 'friend';

interface Props {
  onMatched: (info: MatchedInfo) => void;
}

/** Acilis pratigi akisi (madde h.3): rakip turu -> acilis -> kriterler -> mac. */
export function OpeningPractice({ onMatched }: Props) {
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [chosen, setChosen] = useState<Opening | null>(null);
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');

  const loadOpenings = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      setOpenings(r.ok ? await r.json() : []);
    } catch {
      setOpenings([]);
    }
  }, []);

  useEffect(() => {
    if (opponent && openings === null) void loadOpenings();
  }, [opponent, openings, loadOpenings]);

  // ── Adım 1: rakip türü ─────────────────────────────────────────────────────
  if (!opponent) {
    return (
      <div className="space-y-3">
        {([['bot', '🤖', 'Bota Karşı Pratik Yap'], ['friend', '🤝', 'Arkadaşına Karşı Pratik Yap']] as const)
          .map(([val, emoji, label]) => (
            <button key={val} type="button" onClick={() => setOpponent(val)}
              className="t-card-i w-full flex items-center gap-4 px-4 py-4 text-left">
              <span className="text-2xl">{emoji}</span>
              <span className="font-semibold text-sm flex-1">{label}</span>
            </button>
          ))}
      </div>
    );
  }

  // ── Adım 2: açılış seçimi ──────────────────────────────────────────────────
  if (!chosen) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">Açılış Konumunu Belirle</p>
        {openings === null && <p className="text-sm t-muted">Yükleniyor…</p>}
        {openings?.length === 0 && (
          <p className="text-sm t-muted">Zafer Hoca henüz açılış eklemedi.</p>
        )}
        {openings?.map((o) => (
          <button key={o.id} type="button" onClick={() => setChosen(o)}
            className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left">
            <span className="text-xl">📖</span>
            <span className="font-medium text-sm flex-1">{o.name}</span>
          </button>
        ))}
        <button type="button" onClick={() => setOpponent(null)}
          className="t-btn-ghost px-4 py-2 text-xs">
          ← Rakip türü
        </button>
      </div>
    );
  }

  // ── Adım 3: kriterler ──────────────────────────────────────────────────────
  if (!criteria) {
    // Arkadaş dalında renk/kriter seçimi ChallengeScreen içinde yapılır.
    if (opponent === 'friend') {
      return <ChallengeScreen onMatched={onMatched} />;
    }
    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold t-muted uppercase tracking-wide">
          {chosen.name} — Maç Kriterlerini Belirle
        </p>
        <MatchCriteria
          startLabel="Pratiğe Başla"
          onStart={(v) => { setCriteria(v); setColor(resolveColor(v.colorChoice)); }}
        />
        <button type="button" onClick={() => setChosen(null)}
          className="t-btn-ghost px-4 py-2 text-xs">
          ← Açılış seç
        </button>
      </div>
    );
  }

  // ── Adım 4: maç (bot) ──────────────────────────────────────────────────────
  return (
    <BotGame
      skillLevel={criteria.level.skill}
      depth={criteria.level.depth}
      timeControl={criteria.timeControl}
      studentColor={color}
      startFen={chosen.start_fen}
      onGameEnd={() => {}}
    />
  );
}
