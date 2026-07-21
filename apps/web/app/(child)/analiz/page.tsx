'use client';
import { ComingSoon } from '@/components/ComingSoon';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';

export default function AnalizPage() {
  useTabGuard('analiz');
  const { settings } = useSettings();
  return (
    <ComingSoon
      emoji="🔍"
      title={settings.labels.features.analiz}
      description="Oynadığın maçları ve satranç konumlarını analiz etme özelliği hazırlanıyor."
    />
  );
}
