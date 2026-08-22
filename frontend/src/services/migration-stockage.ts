/**
 * Migration du stockage local hérité — exigence 6 du lot A.
 *
 * Les navigateurs de Family Store et de Radiance portent des données sous les
 * anciennes clés GLOBALES (`pending_sales`, `products`, `access_token`…). Le
 * cloisonnement les rend invisibles : il faut les rattacher à leur boutique
 * avant que quoi que ce soit d'autre ne touche au stockage.
 *
 * Le vrai risque n'est pas la déconnexion — un jeton se retrouve par une
 * reconnexion. Ce sont les **files en attente** : des ventes réelles jamais
 * synchronisées, qui deviendraient orphelines sans que personne ne s'en
 * aperçoive. D'où trois règles :
 *
 *  1. **les files d'abord**, avant les préférences, avant le jeton ;
 *  2. **échec bruyant** : si une file ne peut pas être migrée, on LÈVE. Jamais
 *     de démarrage « propre » laissant des ventes derrière lui ;
 *  3. **idempotence** : un rechargement en plein milieu ne crée pas de doublon.
 *     Une clé héritée n'est effacée qu'APRÈS écriture réussie côté boutique, et
 *     la fusion se fait par identité. Les clés d'idempotence du serveur sont le
 *     filet de dernier recours, pas la première ligne.
 */
import {
  boutiqueDuJeton, definirJeton, boutiqueActive,
  lire, ecrire, lireHerite, supprimerHerite,
  idbLire, idbEcrire, idbLireHerite, idbSupprimerHerite,
} from './storage';

/**
 * Boutique de rattachement quand le jeton hérité ne porte pas de `tenantId`
 * — cas de TOUS les jetons actuellement en circulation, émis avant que le
 * champ n'existe. Les deux instances tournent en mode `single` sur le tenant
 * par défaut du serveur (`DEFAULT_TENANT_ID`), et chacune a son origine web :
 * aucune ambiguïté, aucun risque de croisement.
 */
export const BOUTIQUE_HERITAGE = '000000000000000000000001';

/** Files hors-ligne — migrées EN PREMIER, ce sont elles qui portent des ventes. */
const FILES_HERITEES = [
  'pending_sales',
  'magazin_pending_produits',
  'magazin_pending_receptions',
  'stock_pending_ajouts',
  'stock_pending_ajustements',
] as const;

/** Autres données IndexedDB : un cache perdu se reconstruit, pas une vente. */
const IDB_HERITEES = ['products', 'last_sync_time', 'magazin_temp_id_map'] as const;

/** Clés localStorage de boutique (hors jeton, traité à part et en dernier). */
const LOCAL_HERITEES = [
  'app_settings_cache',
  'fs_held_tickets',
  'fs_brouillon_commande_partenaire',
  'fs_brouillon_livraison_partenaire',
  'fs_depots',
  'fs_transferts',
  'fs_inventaires',
  'receptions_last_seen',
] as const;

export class MigrationStockageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'MigrationStockageError';
  }
}

export interface RapportMigration {
  effectuee: boolean;                    // faux si rien à migrer
  boutique: string;
  files: Record<string, number>;         // éléments repris par file
  clesLocales: string[];
  jetonMigre: boolean;
}

/**
 * Identité d'un élément de file, pour fusionner sans doublon.
 * Les files n'ont pas toutes le même identifiant : `id` (ventes, réceptions),
 * `tempId` (produits), `idempotencyKey` (ajouts de stock), et les ajustements
 * n'en ont aucun — on retombe alors sur la valeur entière.
 */
function identite(element: unknown): string {
  const e = element as Record<string, unknown>;
  if (e && typeof e === 'object') {
    for (const champ of ['id', 'tempId', 'idempotencyKey']) {
      if (typeof e[champ] === 'string' && e[champ]) return `${champ}:${e[champ]}`;
    }
  }
  return `brut:${JSON.stringify(element)}`;
}

/** Union sans doublon : l'existant l'emporte, l'hérité complète. */
function fusionner(existants: unknown[], herites: unknown[]): unknown[] {
  const vus = new Set(existants.map(identite));
  const ajouts = herites.filter(h => !vus.has(identite(h)));
  return [...existants, ...ajouts];
}

/** Y a-t-il quelque chose à migrer ? (permet de ne rien faire au démarrage courant) */
export async function migrationNecessaire(): Promise<boolean> {
  if (lireHerite('access_token')) return true;
  for (const cle of LOCAL_HERITEES) if (lireHerite(cle) !== null) return true;
  for (const cle of [...FILES_HERITEES, ...IDB_HERITEES]) {
    if ((await idbLireHerite(cle)) !== undefined) return true;
  }
  return false;
}

/**
 * Rattache les données héritées à leur boutique.
 *
 * Lève `MigrationStockageError` au moindre échec sur une file : mieux vaut un
 * écran d'erreur explicite qu'une caisse qui démarre en ayant silencieusement
 * enterré des ventes.
 */
export async function migrerStockageHerite(): Promise<RapportMigration> {
  const jetonHerite = lireHerite('access_token');
  const boutique = (jetonHerite && boutiqueDuJeton(jetonHerite)) || BOUTIQUE_HERITAGE;

  const rapport: RapportMigration = {
    effectuee: false, boutique, files: {}, clesLocales: [], jetonMigre: false,
  };

  if (!(await migrationNecessaire())) return rapport;
  rapport.effectuee = true;

  // 1. LES FILES D'ABORD. Un échec ici arrête tout.
  for (const cle of FILES_HERITEES) {
    try {
      const herites = await idbLireHerite<unknown[]>(cle);
      if (herites === undefined) continue;
      const liste = Array.isArray(herites) ? herites : [];

      const existants = (await idbLire<unknown[]>(cle, boutique)) ?? [];
      const fusionnes = fusionner(Array.isArray(existants) ? existants : [], liste);

      await idbEcrire(cle, fusionnes, boutique);
      // Relecture : on ne supprime l'hérité qu'une fois l'écriture CONSTATÉE.
      const relu = (await idbLire<unknown[]>(cle, boutique)) ?? [];
      if (relu.length !== fusionnes.length) {
        throw new Error(`relecture incohérente (${relu.length} ≠ ${fusionnes.length})`);
      }
      await idbSupprimerHerite(cle);
      rapport.files[cle] = liste.length;
    } catch (e) {
      throw new MigrationStockageError(
        `Impossible de migrer la file « ${cle} » vers la boutique ${boutique}. ` +
          "Des ventes ou mouvements non synchronisés s'y trouvent peut-être : " +
          'ne les perdez pas, contactez le support avant de continuer.',
        e,
      );
    }
  }

  // 2. Caches et correspondances : utiles, mais reconstructibles.
  for (const cle of IDB_HERITEES) {
    try {
      const herite = await idbLireHerite<unknown>(cle);
      if (herite === undefined) continue;
      if ((await idbLire(cle, boutique)) === undefined) await idbEcrire(cle, herite, boutique);
      await idbSupprimerHerite(cle);
    } catch { /* un cache perdu se reconstruit au prochain chargement */ }
  }

  // 3. Préférences et brouillons.
  for (const cle of LOCAL_HERITEES) {
    const valeur = lireHerite(cle);
    if (valeur === null) continue;
    if (lire(cle, boutique) === null) ecrire(cle, valeur, boutique);
    supprimerHerite(cle);
    rapport.clesLocales.push(cle);
  }

  // 4. LE JETON EN DERNIER : c'est lui qui désigne la boutique cible. Tant
  //    qu'il est là, une migration interrompue se rejouera correctement.
  if (jetonHerite) {
    definirJeton(boutique, jetonHerite);
    supprimerHerite('access_token');
    rapport.jetonMigre = true;
  } else if (!boutiqueActive()) {
    // Files orphelines sans jeton (utilisateur déconnecté) : elles restent
    // rattachées à leur boutique et repartiront à la prochaine connexion.
  }

  return rapport;
}
