/**
 * Numéro du payeur Mobile Money — format attendu par les opérateurs
 * camerounais : 9 chiffres commençant par 6, sans l'indicatif 237.
 *
 * ⚠️ MIROIR de `frontend/src/utils/telephone.ts` : modifier l'un impose de
 * modifier l'autre. Le client valide avant d'appeler pour dire tout de suite
 * ce qui ne va pas ; le serveur revalide parce que rien de ce qui vient du
 * client ne fait foi.
 *
 * Pourquoi cette rigueur sur un simple numéro : un format accepté à tort
 * n'échoue pas chez nous, il échoue chez l'opérateur, et le message qui
 * revient au commerçant est « solde insuffisant ». Il cherchera alors du
 * côté de son compte MoMo, pas du côté d'une faute de frappe.
 */

/** Renvoie le numéro normalisé (9 chiffres), ou `null` s'il est inexploitable. */
export function normaliserTelephone(brut?: string | null): string | null {
  const chiffres = String(brut ?? '').replace(/\D/g, '').replace(/^237/, '');
  return /^6\d{8}$/.test(chiffres) ? chiffres : null;
}

/** Message unique, employé des deux côtés. */
export const FORMAT_TELEPHONE_ATTENDU =
  'Numéro Mobile Money attendu : 9 chiffres commençant par 6, sans l’indicatif 237.';
