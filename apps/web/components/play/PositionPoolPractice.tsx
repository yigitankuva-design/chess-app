'use client';
import { useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { pickRandomPosition, pickDifferentPosition, turnFromFen } from '@/lib/play/positionPool';
import type { PoolPosition } from '@/lib/play/positionPool';
import { assignExerciseCodes } from '@/lib/exerciseCodes';

interface Props {
  positions: PoolPosition[];
  /** Kriterler dışarıda seçildiyse (ana ekrandan gelindi) kriter ekranı ATLANIR. */
  initialCriteria?: MatchCriteriaValue;
  /** Verilirse maçın üstünde "bölüm adı · konum kodu" satırı çizilir. */
  title?: string;
}

/**
 * Pratik Yap alt sekmelerinde (Açılış Pratiği Yap hariç) bota karşı konum
 * pratiği. Havuzdan rastgele bir konumla başlar; maç bitince "Aynı Konumu
 * Pratik Et" / "Farklı Bir Konumu Pratik Yap" kartları (BotGame'in
 * practiceActions prop'u üzerinden) görünür. Puan/skor KAYDEDİLMEZ.
 */
export function PositionPoolPractice({ positions, initialCriteria, title }: Props) {
  const [criteria, setCriteria] = useState<MatchCriteriaValue | null>(initialCriteria ?? null);
  const [current, setCurrent] = useState<PoolPosition | null>(
    initialCriteria && positions.length > 0 ? pickRandomPosition(positions) : null,
  );
  const [matchKey, setMatchKey] = useState(0);
  // Madde 2 (2026-08-19): renk seçilmez — sporcu her zaman konumun FEN'inde
  // hamle sırası kimdeyse o renkle devam eder.
  const color = current ? turnFromFen(current.fen) : 'w';

  if (positions.length === 0) {
    return <p className="t-muted text-sm">Henüz konum eklenmedi.</p>;
  }

  if (!criteria || !current) {
    return (
      <MatchCriteria
        startLabel="Pratiğe Başla"
        simplifiedLevels
        showColor={false}
        onStart={(v) => {
          setCurrent(pickRandomPosition(positions));
          setCriteria(v);
        }}
      />
    );
  }

  // Kod, hoca'nın admin panelinde gördüğü numarayla AYNI mantıkla üretilir —
  // sporcu ile hoca aynı konumu numarasıyla konuşabilsin.
  const kodlar = assignExerciseCodes(positions);
  const kod = kodlar[positions.findIndex((p) => p.id === current.id)];

  return (
    <>
      {title && (
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <p className="font-semibold text-sm">
            🎯 {title}
            {kod && <span className="t-muted font-mono"> · {kod}</span>}
            {current.owner && <span className="t-muted"> - {current.owner}</span>}
          </p>
        </div>
      )}
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
          setMatchKey((k) => k + 1);
        },
      }}
    />
    </>
  );
}
