'use client';
import { useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { pickRandomPosition, pickDifferentPosition } from '@/lib/play/positionPool';
import type { PoolPosition } from '@/lib/play/positionPool';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';

interface Props {
  positions: PoolPosition[];
}

/**
 * Pratik Yap alt sekmelerinde (Açılış Pratiği Yap hariç) bota karşı konum
 * pratiği. Havuzdan rastgele bir konumla başlar; maç bitince "Aynı Konumu
 * Pratik Et" / "Farklı Bir Konumu Pratik Yap" kartları (BotGame'in
 * practiceActions prop'u üzerinden) görünür. Puan/skor KAYDEDİLMEZ.
 */
export function PositionPoolPractice({ positions }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(null);
  const [color, setColor] = useState<PieceColor>('w');
  const [current, setCurrent] = useState<PoolPosition | null>(null);
  const [matchKey, setMatchKey] = useState(0);

  if (positions.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  if (!criteria || !current) {
    return (
      <MatchCriteria
        startLabel="Pratiğe Başla"
        onStart={(v) => {
          setCurrent(pickRandomPosition(positions));
          setCriteria(v);
          setColor(resolveColor(v.colorChoice));
        }}
      />
    );
  }

  return (
    <BotGame
      key={matchKey}
      skillLevel={criteria.level.skill}
      depth={criteria.level.depth}
      blunderChance={criteria.level.blunderChance}
      timeControl={criteria.timeControl}
      studentColor={color}
      startFen={current.fen}
      onGameEnd={() => {}}
      practiceActions={{
        onPlaySame: () => setMatchKey((k) => k + 1),
        onPlayDifferent: () => {
          const next = pickDifferentPosition(positions, current.id);
          setCurrent(next);
          setColor(resolveColor(criteria.colorChoice));
          setMatchKey((k) => k + 1);
        },
      }}
    />
  );
}
