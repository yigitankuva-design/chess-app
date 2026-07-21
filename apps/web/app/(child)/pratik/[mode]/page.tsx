'use client';
import { useParams } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';

const MODES: Record<string, { emoji: string; title: string; desc: string }> = {
  suresiz: {
    emoji: '♾️', title: 'Süresiz Pratik Yap',
    desc: 'Süre baskısı olmadan, dilediğin kadar soru çözebileceğin pratik modu hazırlanıyor.',
  },
  sureli: {
    emoji: '⏱️', title: 'Süreli Pratik Yap',
    desc: 'Sayaca karşı yarışarak soru çözeceğin süreli pratik modu hazırlanıyor.',
  },
  test: {
    emoji: '📝', title: 'Kendini Test Et',
    desc: 'Puanlı test modu ile kendini sınayabileceğin bölüm hazırlanıyor.',
  },
};

export default function PratikPage() {
  const params = useParams();
  const slug = String(params.mode ?? '');
  const m = MODES[slug] ?? { emoji: '🎯', title: 'Pratik', desc: 'Bu içerik hazırlanıyor.' };
  return <ComingSoon emoji={m.emoji} title={m.title} description={m.desc} />;
}
