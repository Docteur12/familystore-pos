import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettings, SETTINGS_DEFAULTS, StoreSettings, applyPrimaryColor, applySecondaryColor, moduleActif, ModuleId } from '../api/settings';
import { syncLang } from '../i18n';

interface SettingsCtx {
  settings: StoreSettings;
  reloadSettings: () => void;
  /** Le module est-il activé pour ce magasin ? (menus, routes) */
  hasModule: (id: ModuleId) => boolean;
}

const Ctx = createContext<SettingsCtx>({
  settings: SETTINGS_DEFAULTS,
  reloadSettings: () => {},
  hasModule: () => true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(SETTINGS_DEFAULTS);

  const load = useCallback(() => {
    getSettings().then(s => {
      setSettings(s);
      if (s.couleurPrincipale) applyPrimaryColor(s.couleurPrincipale);
      if (s.couleurSecondaire) applySecondaryColor(s.couleurSecondaire);
      // Langue de l'interface : si elle diffère de la langue locale, la page
      // est rechargée pour que toute l'interface bascule (voir i18n/index.ts).
      syncLang(s.langue);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasModule = useCallback((id: ModuleId) => moduleActif(settings, id), [settings]);

  return <Ctx.Provider value={{ settings, reloadSettings: load, hasModule }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx);
}
