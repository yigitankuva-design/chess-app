'use client';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings/settings-context';
import type { AppSettingsData } from '@/lib/settings/defaults';

type SubKey = 'yeni' | 'gecmis' | 'konum';

/** Madde 2026-09-01 (5): sıralama a) Yeni Analiz b) Maçlarımın Analizi c) Konum Analizi.
 *  Madde 2026-09-05 (3): her alt sekme admin'den ayrı ayrı aç/kapa edilebilir —
 *  featureKey ilgili AppSettingsData['analizFeatures'] alanına karşılık gelir. */
const SUB_TABS: { key: SubKey; label: string; href: string; featureKey: keyof AppSettingsData['analizFeatures'] }[] = [
  { key: 'yeni', label: 'Yeni Analiz', href: '/analiz/yeni', featureKey: 'freePlay' },
  { key: 'gecmis', label: 'Maçlarımın Analizi', href: '/analiz/maclarim', featureKey: 'matches' },
  { key: 'konum', label: 'Konum Analizi', href: '/analiz/konum', featureKey: 'position' },
];

/** Madde 2026-09-01 (2): alt sekmelerde İKON YOK — düz, kalın yazılı bir satır. */
function SubRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left font-bold transition-transform active:scale-[0.98]"
      style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '0.86rem', color: 'var(--t-text-1)' }}>
      {label}
    </button>
  );
}

/**
 * Hızlı Erişim "Analiz Et" kutucuğu açılınca görünen alt sekme listesi.
 * Madde 2026-09-02: her alt sekme artık AYRI BİR SAYFAYA yönlendirir —
 * "Yeni Analiz" doğrudan sıfırdan (ilk hamleden) bir analiz tahtasına gider,
 * "Maçlarımın Analizi" maç listesi+inceleme sayfasına, "Konum Analizi" konum
 * ekleme+analiz sayfasına.
 */
export function AnalizPanel() {
  const router = useRouter();
  const { settings } = useSettings();
  const visible = SUB_TABS.filter((t) => settings.analizFeatures[t.featureKey] !== false);

  return (
    <div className="grid gap-3">
      {visible.map((t) => (
        <SubRow key={t.key} label={t.label} onClick={() => router.push(t.href)} />
      ))}
    </div>
  );
}
