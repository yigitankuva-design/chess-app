'use client';
import { useCallback, useEffect, useState } from 'react';
import { BotGame } from '@/components/BotGame';
import { FriendChallenge } from '@/components/play/FriendChallenge';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';
import { StepCard } from '@/components/play/StepCard';
import { isCriteriaUnlocked, openingSummary } from '@/lib/play/openingSteps';
import type { BotStepKey } from '@/lib/play/openingSteps';
import { resolveColor } from '@/lib/play/color';
import type { PieceColor } from '@/lib/play/color';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string }

/** Acilis pratigi: sirali ve kilitli acilir kartlar (akordiyon).
 *  Dis katman: bot / arkadas. Ic katman (bot): acilis -> kriterler. */
export function OpeningPractice() {
  const [openOuter, setOpenOuter] = useState<'bot' | 'friend' | null>(null);
  const [openInner, setOpenInner] = useState<BotStepKey | null>('opening');
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

  // Acilislar YALNIZCA bir dal acildiginda yuklenir — gereksiz istek atilmaz.
  // Madde 6: arkadas dalinda da acilis secildigi icin o dal da tetikler.
  useEffect(() => {
    if (openOuter !== null && openings === null) void loadOpenings();
  }, [openOuter, openings, loadOpenings]);

  /** Acilis listesi iki dalda da AYNI — tek yerde durur, kopyalanmaz. */
  const openingList = (onPicked: () => void) => (
    <div className="space-y-2">
      {openings === null && <p className="text-sm t-muted">Yükleniyor…</p>}
      {openings?.length === 0 && (
        <p className="text-sm t-muted">Zafer Hoca henüz açılış eklemedi.</p>
      )}
      {openings?.map((o) => (
        <button key={o.id} type="button"
          onClick={() => { setChosen(o); onPicked(); }}
          className="t-card-i w-full flex items-center gap-3 px-4 py-3 text-left">
          <span className="text-xl">📖</span>
          <span className="font-medium text-sm flex-1">{o.name}</span>
        </button>
      ))}
    </div>
  );

  // Kriterler secildi -> mac basladi; akordiyon yerini tahtaya birakir.
  if (criteria && chosen) {
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

  return (
    <div className="space-y-3">
      <StepCard
        emoji="🤖"
        title="Bota Karşı Pratik Yap"
        open={openOuter === 'bot'}
        onToggle={() => setOpenOuter((p) => (p === 'bot' ? null : 'bot'))}
      >
        <div className="space-y-3">
          <StepCard
            stepNumber={1}
            title="Açılış Konumunu Seç"
            summary={openingSummary(chosen?.name ?? null)}
            open={openInner === 'opening'}
            onToggle={() => setOpenInner((p) => (p === 'opening' ? null : 'opening'))}
          >
            {openingList(() => setOpenInner('criteria'))}
          </StepCard>

          <StepCard
            stepNumber={2}
            title="Maç Kriterlerini Seç"
            open={openInner === 'criteria'}
            locked={!isCriteriaUnlocked(chosen?.name ?? null)}
            onToggle={() => setOpenInner((p) => (p === 'criteria' ? null : 'criteria'))}
          >
            <MatchCriteria
              startLabel="Pratiğe Başla"
              onStart={(v) => {
                // Kilit yalnizca gorsel degil: acilis yoksa mac hic baslamaz.
                if (!chosen) return;
                setCriteria(v);
                setColor(resolveColor(v.colorChoice));
              }}
            />
          </StepCard>
        </div>
      </StepCard>

      <StepCard
        emoji="🤝"
        title="Arkadaşına Karşı Pratik Yap"
        open={openOuter === 'friend'}
        onToggle={() => setOpenOuter((p) => (p === 'friend' ? null : 'friend'))}
      >
        {/* Madde 6: arkadas dalinda sira 1) Acilis 2) Kriterler 3) Arkadas */}
        <FriendChallenge
          openingStep={{
            render: openingList,
            summary: openingSummary(chosen?.name ?? null),
            picked: chosen !== null,
            startFen: chosen?.start_fen ?? null,
          }}
        />
      </StepCard>
    </div>
  );
}
