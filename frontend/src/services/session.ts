/**
 * Session et bascule de boutique — le point de passage unique.
 *
 * Réunit ici ce qui était éparpillé dans une douzaine de boutons
 * « Déconnexion » faisant chacun `localStorage.removeItem('access_token')` :
 * avec le stockage cloisonné, un seul de ces raccourcis oublié laisserait un
 * jeton dormant ou perdrait une file hors-ligne.
 *
 * Deux règles non négociables :
 *  - **on ne perd jamais une vente en silence** : s'il reste des éléments non
 *    synchronisés, l'utilisateur est averti AVANT toute purge et peut annuler ;
 *  - **aucun jeton dormant** : la déconnexion retire les jetons de TOUTES les
 *    boutiques, pas seulement celle qu'on consultait.
 */
import {
  boutiqueActive, toutesLesBoutiquesConnues, definirJeton, boutiqueDuJeton,
  purgerBoutique, idbPurgerBoutique, supprimerTousLesJetons, idbLire, jetonDeBoutique,
} from './storage';
import { t } from '../i18n';

/** Files hors-ligne d'une boutique, par nature. */
export interface FilesEnAttente {
  ventes: number;
  produits: number;
  receptions: number;
  ajouts: number;
  ajustements: number;
  total: number;
}

const CLES_FILES = [
  ['ventes', 'pending_sales'],
  ['produits', 'magazin_pending_produits'],
  ['receptions', 'magazin_pending_receptions'],
  ['ajouts', 'stock_pending_ajouts'],
  ['ajustements', 'stock_pending_ajustements'],
] as const;

/** Compte ce qui attend d'être envoyé pour une boutique donnée. */
export async function filesEnAttente(boutiqueId: string): Promise<FilesEnAttente> {
  const compte: any = { ventes: 0, produits: 0, receptions: 0, ajouts: 0, ajustements: 0, total: 0 };
  for (const [nom, cle] of CLES_FILES) {
    const liste = (await idbLire<unknown[]>(cle, boutiqueId)) ?? [];
    compte[nom] = Array.isArray(liste) ? liste.length : 0;
    compte.total += compte[nom];
  }
  return compte as FilesEnAttente;
}

/**
 * Boutiques dont la file attend un envoi alors que leur jeton a disparu ou
 * expiré : impossible de les synchroniser sans une reconnexion SUR CETTE
 * boutique. L'interface doit le dire explicitement — un échec muet coûterait
 * les ventes.
 */
export async function boutiquesBloquees(): Promise<{ boutiqueId: string; total: number }[]> {
  const bloquees: { boutiqueId: string; total: number }[] = [];
  // Vue TOUS SUPPORTS : une boutique au jeton expiré n'a plus rien en
  // localStorage, mais ses ventes dorment encore dans IndexedDB. La chercher
  // ailleurs reviendrait à ne jamais signaler le cas qui compte.
  for (const id of await toutesLesBoutiquesConnues()) {
    const { total } = await filesEnAttente(id);
    if (total > 0 && !jetonDeBoutique(id)) bloquees.push({ boutiqueId: id, total });
  }
  return bloquees;
}

/** Message d'avertissement listant ce qui serait perdu. */
export function messagePerteFiles(f: FilesEnAttente): string {
  const morceaux: string[] = [];
  if (f.ventes)       morceaux.push(`${f.ventes} ${t('vente(s)', 'sale(s)')}`);
  if (f.produits)     morceaux.push(`${f.produits} ${t('produit(s)', 'product(s)')}`);
  if (f.receptions)   morceaux.push(`${f.receptions} ${t('réception(s)', 'goods receipt(s)')}`);
  if (f.ajouts)       morceaux.push(`${f.ajouts} ${t('ajout(s) de stock', 'stock addition(s)')}`);
  if (f.ajustements)  morceaux.push(`${f.ajustements} ${t('ajustement(s)', 'adjustment(s)')}`);
  return (
    t('Attention : ', 'Warning: ') + morceaux.join(', ') + ' ' +
    t(
      "n'ont pas encore été envoyés au serveur. Se déconnecter maintenant les supprimera définitivement.\n\nSe déconnecter quand même ?",
      'have not been sent to the server yet. Logging out now will delete them permanently.\n\nLog out anyway?',
    )
  );
}

/**
 * Déconnexion complète.
 *
 * Purge les données de la boutique active et retire les jetons de toutes les
 * boutiques. Si des éléments non synchronisés seraient perdus, demande
 * confirmation d'abord ; renvoie `false` si l'utilisateur renonce (rien n'est
 * alors touché).
 *
 * `confirmer` est injectable pour les tests — par défaut, la boîte de
 * dialogue du navigateur.
 */
export async function deconnexion(
  confirmer: (message: string) => boolean = m => window.confirm(m),
): Promise<boolean> {
  const active = boutiqueActive();

  if (active) {
    const files = await filesEnAttente(active);
    if (files.total > 0 && !confirmer(messagePerteFiles(files))) return false;
    purgerBoutique(active);
    await idbPurgerBoutique(active);
  }

  // Aucun jeton dormant ne survit à une déconnexion, même pour une boutique
  // qu'on ne consultait pas.
  supprimerTousLesJetons();
  return true;
}

/**
 * Bascule vers une autre boutique.
 *
 * Le contexte en mémoire est reconstruit par le rechargement de la page ; les
 * files hors-ligne des DEUX boutiques survivent — un caissier qui bascule ne
 * doit jamais perdre les ventes non synchronisées de l'autre.
 */
export function basculerVersBoutique(jetonAcces: string): void {
  const boutiqueId = boutiqueDuJeton(jetonAcces);
  if (!boutiqueId) throw new Error('Jeton sans identifiant de boutique (tenantId absent).');
  definirJeton(boutiqueId, jetonAcces);
}
