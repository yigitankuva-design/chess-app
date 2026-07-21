'use client';
import { useParams } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';
import { useTabGuard } from '@/lib/settings/useTabGuard';

const GAMES: Record<string, { emoji: string; title: string; desc: string }> = {
  'bulmaca-duellosu': {
    emoji: '⚔️', title: 'Bulmaca Düellosu',
    desc: 'Arkadaşınla karşılıklı bulmaca düellosu modu hazırlanıyor.',
  },
  'bulmaca-firtinasi': {
    emoji: '🌪️', title: 'Bulmaca Fırtınası',
    desc: 'Süreye karşı üst üste bulmaca çözme modu hazırlanıyor.',
  },
  'koordinat-yarisi': {
    emoji: '🏁', title: 'Koordinat Yarışı',
    desc: 'Kare koordinatlarını hızlıca bulma yarışı hazırlanıyor.',
  },
  'acilisi-tahmin-et': {
    emoji: '🎯', title: 'Açılışı Tahmin Et',
    desc: 'Açılışları tanıma ve tahmin etme oyunu hazırlanıyor.',
  },
};

export default function EglenceGamePage() {
  useTabGuard('eglence');
  const params = useParams();
  const slug = String(params.game ?? '');
  const g = GAMES[slug] ?? { emoji: '🎉', title: 'Eğlence', desc: 'Bu içerik hazırlanıyor.' };
  return <ComingSoon emoji={g.emoji} title={g.title} description={g.desc} />;
}
