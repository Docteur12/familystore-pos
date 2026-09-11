import type { ModuleId, TypeEtablissement } from './settings';

/**
 * Préréglages par type d'établissement — MIROIR de
 * `backend/src/settings/profils.ts` (mêmes modules, même accueil par type),
 * verrouillé par `profils-governance.spec.ts`.
 *
 * Le frontend n'en lit que deux choses : l'écran d'accueil du caissier
 * (`HomeRedirect`) et, pour l'affichage, les modules qu'un type active.
 */
export interface ProfilFront {
  modules: ModuleId[] | 'tous';
  accueilCaissier: string;
}

export const PROFILS: Record<TypeEtablissement, ProfilFront> = {
  commerce:   { modules: 'tous',                accueilCaissier: '/caisse-pin' },
  snack:      { modules: ['comptoir'],          accueilCaissier: '/comptoir' },
  restaurant: { modules: ['comptoir', 'salle'], accueilCaissier: '/salle' },
  hotel:      { modules: ['reception'],         accueilCaissier: '/reception' },
};

/**
 * Accueil du caissier pour un type, borné aux routes qui EXISTENT.
 *
 * Les routes des profils sont branchées par les branches verticales ; tant
 * qu'une route n'est pas déclarée dans `App.tsx` (et ajoutée à
 * `implementes`), un caissier de ce type retombe sur la caisse commerce
 * plutôt que sur une page blanche.
 */
export function accueilCaissier(type: TypeEtablissement, implementes: ReadonlySet<string>): string {
  const voulu = PROFILS[type]?.accueilCaissier ?? PROFILS.commerce.accueilCaissier;
  return implementes.has(voulu) ? voulu : PROFILS.commerce.accueilCaissier;
}
