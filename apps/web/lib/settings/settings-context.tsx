'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { AppSettingsData, DEFAULT_SETTINGS, mergeSettings } from './defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SettingsContextValue {
  settings: AppSettingsData;
  reload: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  reload: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettingsData>(DEFAULT_SETTINGS);

  const load = useCallback(() => {
    fetch(`${API_BASE}/settings`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setSettings(mergeSettings(d)))
      .catch(() => setSettings(DEFAULT_SETTINGS)); // fail-safe: varsayılan
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingsContext.Provider value={{ settings, reload: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
