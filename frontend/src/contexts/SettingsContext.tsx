import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettings, SETTINGS_DEFAULTS, StoreSettings, applyPrimaryColor } from '../api/settings';

interface SettingsCtx {
  settings: StoreSettings;
  reloadSettings: () => void;
}

const Ctx = createContext<SettingsCtx>({
  settings: SETTINGS_DEFAULTS,
  reloadSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(SETTINGS_DEFAULTS);

  const load = useCallback(() => {
    getSettings().then(s => {
      setSettings(s);
      if (s.couleurPrincipale) applyPrimaryColor(s.couleurPrincipale);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return <Ctx.Provider value={{ settings, reloadSettings: load }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx);
}
