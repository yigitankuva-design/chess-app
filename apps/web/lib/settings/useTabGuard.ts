'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from './settings-context';
import type { AppSettingsData } from './defaults';

/** Admin bu sekmeyi kapattıysa, doğrudan URL ile girişi de /home'a yönlendirir. */
export function useTabGuard(tabKey: keyof AppSettingsData['tabs']) {
  const { settings } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (settings.tabs[tabKey] === false) {
      router.replace('/home');
    }
  }, [settings.tabs, tabKey, router]);
}
