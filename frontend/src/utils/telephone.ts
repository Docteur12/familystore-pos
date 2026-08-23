import { t } from '../i18n';

/**
 * Numéro du payeur Mobile Money — 9 chiffres commençant par 6, sans
 * l'indicatif 237.
 *
 * ⚠️ MIROIR de `backend/src/platform/paiement/telephone.ts` : modifier l'un
 * impose de modifier l'autre. Le serveur revalide de toute façon — ce
 * contrôle-ci sert à dire tout de suite ce qui ne va pas, plutôt qu'après un
 * aller-retour réseau.
 *
 * L'enjeu n'est pas cosmétique : un numéro mal formé n'échoue pas chez nous
 * mais chez l'opérateur, et le message qui revient au commerçant est « solde
 * insuffisant ». Il ira chercher du côté de son compte MoMo, jamais du côté
 * d'une faute de frappe.
 */

/** Renvoie le numéro normalisé (9 chiffres), ou `null` s'il est inexploitable. */
export function normaliserTelephone(brut?: string | null): string | null {
  const chiffres = String(brut ?? '').replace(/\D/g, '').replace(/^237/, '');
  return /^6\d{8}$/.test(chiffres) ? chiffres : null;
}

/** Message d'aide, traduit. */
export function formatTelephoneAttendu(): string {
  return t(
    'Numéro Mobile Money attendu : 9 chiffres commençant par 6, sans l’indicatif 237.',
    'Mobile Money number expected: 9 digits starting with 6, without the 237 prefix.',
  );
}
