import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettings, SETTINGS_DEFAULTS, StoreSettings, applyPrimaryColor, applySecondaryColor, moduleActif, ModuleId } from '../api/settings';
import { syncLang } from '../i18n';

interface SettingsCtx {
  settings: StoreSettings;
  reloadSettings: () => void;
  /** Le module est-il activé pour ce magasin ? (menus, routes) */
  hasModule: (id: ModuleId) => boolean;
}

// Cache local des paramètres du magasin : affichés dès le premier rendu, avant
// la réponse de l'API. Sans lui, chaque démarrage montrait un « flash » des
// valeurs par défaut (nom, logo, couleurs Family Store) le temps que le
// serveur réponde — plusieurs secondes quand Render sort de veille.
const CACHE_KEY = 'app_settings_cache';

function settingsInitiaux(): StoreSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...SETTINGS_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* cache illisible : valeurs par défaut */ }
  return SETTINGS_DEFAULTS;
}

// Applique thème et langue d'un jeu de paramètres (au démarrage comme au rechargement).
function appliquer(s: StoreSettings) {
  if (s.couleurPrincipale) applyPrimaryColor(s.couleurPrincipale);
  if (s.couleurSecondaire) applySecondaryColor(s.couleurSecondaire);
  // Langue de l'interface : si elle diffère de la langue locale, la page
  // est rechargée pour que toute l'interface bascule (voir i18n/index.ts).
  syncLang(s.langue);
}

const Ctx = createContext<SettingsCtx>({
  settings: SETTINGS_DEFAULTS,
  reloadSettings: () => {},
  hasModule: () => true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(settingsInitiaux);

  const load = useCallback(() => {
    getSettings().then(s => {
      setSettings(s);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* stockage plein : tant pis */ }
      appliquer(s);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    appliquer(settingsInitiaux());   // thème immédiat depuis le cache
    load();                          // puis rafraîchissement depuis l'API
  }, [load]);

  const hasModule = useCallback((id: ModuleId) => moduleActif(settings, id), [settings]);

  return <Ctx.Provider value={{ settings, reloadSettings: load, hasModule }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx);
}
