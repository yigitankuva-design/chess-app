'use client';
import { useRouter } from 'next/navigation';

type SubKey = 'yeni' | 'gecmis' | 'konum';

/** Madde 2026-09-01 (5): sıralama a) Yeni Analiz b) Maçlarımın Analizi c) Konum Analizi. */
const SUB_TABS: { key: SubKey; label: string; href: string }[] = [
  { key: 'yeni', label: 'Yeni Analiz', href: '/analiz/yeni' },
  { key: 'gecmis', label: 'Maçlarımın Analizi', href: '/analiz/maclarim' },
  { key: 'konum', label: 'Konum Analizi', href: '/analiz/konum' },
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

  return (
    <div className="grid gap-3">
      {SUB_TABS.map((t) => (
        <SubRow key={t.key} label={t.label} onClick={() => router.push(t.href)} />
      ))}
    </div>
  );
}
