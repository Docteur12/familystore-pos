// Langue de l'interface — fixée par l'administrateur dans Paramètres magasin
// (champ « langue », synchronisé par SettingsContext).
//
// La langue est lue de façon synchrone au démarrage (localStorage) pour que
// t() soit utilisable partout, y compris hors composants React (tickets, PDF…).
//
// Traduction inline par paires : t('texte français', 'english text'). Deux
// langues, un seul dépôt : Family Store (FR) et Radiance (EN) partagent ce code.

// La langue est un réglage d'APPAREIL, non cloisonné par boutique : elle est
// de toute façon resynchronisée depuis Settings.langue à chaque chargement.
import { lireGlobal, ecrireGlobal } from '../services/storage';

export type Lang = 'fr' | 'en';

const LS_KEY = 'app_lang';

// Français par défaut ; l'anglais est activé par les paramètres du magasin.
let lang: Lang = lireGlobal(LS_KEY) === 'en' ? 'en' : 'fr';

export function getLang(): Lang {
  return lang;
}

/**
 * Écrit la langue SANS recharger — à utiliser quand un rechargement est déjà
 * prévu par l'appelant (bascule de boutique).
 *
 * Sans cela, passer d'une boutique en français à une boutique en anglais
 * enchaînait DEUX rechargements : celui de la bascule, puis celui déclenché
 * par `syncLang` quand les paramètres de la nouvelle boutique arrivaient. En
 * pleine session de caisse, ça donne l'impression d'un logiciel instable.
 * En posant la langue avant, le rechargement unique suffit et `syncLang` ne
 * trouve plus rien à changer.
 */
export function preparerLangue(l: string | undefined): void {
  ecrireGlobal(LS_KEY, l === 'en' ? 'en' : 'fr');
}

// Synchronise la langue locale avec celle des paramètres du magasin.
// Si elle change, on recharge la page pour que toute l'interface bascule.
export function syncLang(l: string | undefined) {
  const next: Lang = l === 'en' ? 'en' : 'fr';
  if (next !== lang) {
    ecrireGlobal(LS_KEY, next);
    window.location.reload();
  }
}

// Traduction inline : t('texte français', 'english text')
export function t(fr: string, en: string): string {
  return lang === 'en' ? en : fr;
}

// Locale à passer à toLocaleDateString / toLocaleString / localeCompare
export function dateLocale(): string {
  return lang === 'en' ? 'en-GB' : 'fr-FR';
}

// Attribut lang du document (accessibilité, césure, correcteurs)
document.documentElement.lang = lang;
