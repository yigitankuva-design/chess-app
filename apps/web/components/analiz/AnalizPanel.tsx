'use client';
import { useState } from 'react';
import { Branch } from '@/components/ui/neumorphic';
import { GameAnalysisSection } from './GameAnalysisSection';
import { CustomPositionAnalysis } from './CustomPositionAnalysis';

type SubKey = 'yeni' | 'gecmis' | 'konum';

/** Madde 2026-09-01 (5): sıralama a) Yeni Analiz b) Maçlarımın Analizi c) Konum Analizi. */
const SUB_TABS: { key: SubKey; label: string }[] = [
  { key: 'yeni', label: 'Yeni Analiz' },
  { key: 'gecmis', label: 'Maçlarımın Analizi' },
  { key: 'konum', label: 'Konum Analizi' },
];

/** Madde 2026-09-01 (2): alt sekmelerde İKON YOK — PathNode'un zorunlu ikon
 *  dairesi yerine düz, kalın yazılı bir satır. */
function SubRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left font-bold transition-transform active:scale-[0.98]"
      style={{
        background: 'transparent', border: 'none', padding: 0, fontSize: '0.86rem',
        color: active ? 'var(--t-accent)' : 'var(--t-text-1)',
      }}>
      {label}
    </button>
  );
}

/**
 * Hızlı Erişim "Analiz Et" kutucuğu açılınca AYNI EKRANDA görünen alt sekme
 * listesi (madde 2026-09-01 (1)) — artık ayrı bir sayfaya (/analiz)
 * yönlendirilmiyor, Maç Yap/Dersler/Pratik Yap'la AYNI akordiyon deseni.
 * "Yeni Analiz" ve "Maçlarımın Analizi" AYNI bileşeni (GameAnalysisSection)
 * kullanır — kendi bağımsız state'leriyle iki ayrı örnek (madde 4).
 */
export function AnalizPanel() {
  const [open, setOpen] = useState<SubKey | null>(null);

  return (
    <div className="grid gap-3">
      {SUB_TABS.map((t) => (
        <div key={t.key}>
          <SubRow label={t.label} active={open === t.key}
            onClick={() => setOpen((p) => (p === t.key ? null : t.key))} />
          {open === t.key && (
            <Branch offset={4}>
              {t.key === 'konum' ? <CustomPositionAnalysis /> : <GameAnalysisSection />}
            </Branch>
          )}
        </div>
      ))}
    </div>
  );
}
