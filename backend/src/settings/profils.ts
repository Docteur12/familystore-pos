import { ModuleId, TypeEtablissement, TYPES_ETABLISSEMENT } from './settings.schema';

/**
 * Préréglages par type d'établissement — la table unique de la gamme.
 *
 * Un type dit trois choses à la création d'une boutique (et quand le
 * superadmin change le type en demandant d'appliquer le préréglage) :
 *  - quels MODULES optionnels sont actifs (`'tous'` = liste vide dans
 *    Settings, c'est-à-dire tout actif — le comportement historique de
 *    Commerce) ;
 *  - quelles RÈGLES MÉTIER partent différemment (péremption suivie ou non…) ;
 *  - où atterrit un CAISSIER à la connexion (le poste de vente du profil).
 *
 * Miroir de frontend/src/api/profils.ts — verrouillé par
 * profils-governance.spec.ts (mêmes modules, même accueil, par type).
 *
 * Les routes `/comptoir`, `/salle`, `/reception` sont celles que les
 * branches verticales brancheront (CAMELEON-GAMME.md §4) ; tant qu'elles
 * n'existent pas, `HomeRedirect` retombe sur la caisse commerce.
 */
export interface Profil {
  modules: ModuleId[] | 'tous';
  metier: { inactiviteMinutes?: number; seedFournisseursDemo?: boolean; suiviPeremption?: boolean };
  accueilCaissier: string;
}

export const PROFILS: Record<TypeEtablissement, Profil> = {
  commerce:   { modules: 'tous',                metier: {},                                                  accueilCaissier: '/caisse-pin' },
  snack:      { modules: ['comptoir'],          metier: { suiviPeremption: true,  seedFournisseursDemo: false }, accueilCaissier: '/comptoir' },
  restaurant: { modules: ['comptoir', 'salle'], metier: { suiviPeremption: true,  seedFournisseursDemo: false }, accueilCaissier: '/salle' },
  hotel:      { modules: ['reception'],         metier: { suiviPeremption: false, seedFournisseursDemo: false }, accueilCaissier: '/reception' },
};

export function estTypeEtablissement(v: unknown): v is TypeEtablissement {
  return typeof v === 'string' && (TYPES_ETABLISSEMENT as readonly string[]).includes(v);
}

/**
 * Ce qu'on écrit dans Settings pour un type donné : `modules` (liste vide pour
 * « tous ») et `metier` fusionné avec les défauts fournis.
 */
export function prereglage(type: TypeEtablissement, metierDefauts: Record<string, unknown> = {}) {
  const p = PROFILS[type];
  return {
    typeEtablissement: type,
    modules: p.modules === 'tous' ? [] : [...p.modules],
    metier: { ...metierDefauts, ...p.metier },
  };
}
