'use client';
import { ComingSoon } from '@/components/ComingSoon';
import { useTabGuard } from '@/lib/settings/useTabGuard';
import { useSettings } from '@/lib/settings/settings-context';

export default function EglencePage() {
  useTabGuard('eglence');
  const { settings } = useSettings();
  return (
    <ComingSoon
      emoji="🎉"
      title={settings.labels.features.eglence}
      description="Satranç temalı eğlenceli mini oyunlar ve etkinlikler hazırlanıyor."
    />
  );
}
