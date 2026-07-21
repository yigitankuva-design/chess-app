'use client';
import { useParams, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const slug = String(params.mode ?? '');
  const konu = searchParams.get('konu');
  const m = MODES[slug] ?? { emoji: '🎯', title: 'Pratik', desc: 'Bu içerik hazırlanıyor.' };
  const desc = konu ? `“${konu}” alt konusu için: ${m.desc}` : m.desc;
  return <ComingSoon emoji={m.emoji} title={m.title} description={desc} />;
}
