/**
 * Contexte tenant — la source unique de vérité pour « à quel magasin
 * appartient la requête en cours ».
 *
 * S'appuie sur nestjs-cls (AsyncLocalStorage) via son singleton de processus
 * ClsServiceManager : le même contexte est vu par le code applicatif ET par
 * les hooks du plugin Mongoose, sans avoir à câbler quoi que ce soit entre
 * les deux.
 *
 * Règle cardinale — FAIL-CLOSED : hors de tout contexte tenant, lire l'ID
 * lève une erreur. Jamais de repli silencieux vers « toutes les données » :
 * une requête sans tenant est un bug, pas une requête globale.
 */
import { InternalServerErrorException } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { Types } from 'mongoose';

/** Clé du tenant dans le store CLS. */
export const TENANT_KEY = 'tenantId';

/**
 * Tenant par défaut du mode « single » (une seule boutique par base).
 *
 * ObjectId fixe et déterministe : aucune recherche en base n'est nécessaire
 * pour le résoudre.
 *
 * SOURCE UNIQUE — NE PAS DUPLIQUER. Le script de migration du bloc 3 pose
 * CETTE valeur sur toutes les données existantes de Family Store et Radiance.
 * Si les deux divergent, une instance démarrerait en mode single avec un
 * tenant différent de celui de ses propres données → base « vide » à l'écran.
 * Toute autre partie du code (migration, seed, tests) DOIT importer cette
 * constante, jamais réécrire le littéral.
 */
export const DEFAULT_TENANT_ID = new Types.ObjectId('000000000000000000000001');

/** Modes de fonctionnement, pilotés par la variable d'environnement TENANT_MODE. */
export type TenantMode = 'single' | 'multi';

/**
 * Mode courant. Défaut « single » : une instance existante (Family Store,
 * Radiance) démarre à l'identique, un tenant unique par défaut, sans migration
 * immédiate ni changement visible. « multi » active la résolution du tenant
 * depuis le JWT (SaaS mutualisé).
 */
export function getTenantMode(): TenantMode {
  return process.env.TENANT_MODE === 'multi' ? 'multi' : 'single';
}

/** Récupère le ClsService singleton du processus. */
function cls() {
  return ClsServiceManager.getClsService();
}

/**
 * Établit un contexte tenant autour d'une fonction — pour tout ce qui tourne
 * HORS d'une requête HTTP : tests, scripts de migration, tâches planifiées,
 * webhooks. En requête HTTP, c'est le TenantInterceptor qui pose la valeur.
 */
export function runWithTenant<T>(tenantId: string | Types.ObjectId, fn: () => T): T {
  return cls().run(() => {
    cls().set(TENANT_KEY, String(tenantId));
    return fn();
  });
}

/**
 * Pose l'ID du tenant dans le contexte courant (déjà établi en amont).
 * Utilisé par le TenantInterceptor après que le contexte CLS a été monté par
 * le middleware. Lève si appelé hors contexte — signe d'un câblage incorrect.
 */
export function setTenantId(tenantId: string | Types.ObjectId): void {
  if (!cls().isActive()) {
    throw new InternalServerErrorException(
      'setTenantId appelé hors contexte CLS — le middleware CLS doit être monté avant.',
    );
  }
  cls().set(TENANT_KEY, String(tenantId));
}

/** ID du tenant courant, ou null si absent — sans lever. */
export function getTenantIdOrNull(): string | null {
  if (!cls().isActive()) return null;
  return cls().get(TENANT_KEY) ?? null;
}

/**
 * ID du tenant courant — FAIL-CLOSED. Lève si aucun contexte tenant n'est
 * établi. C'est ce que le plugin Mongoose appelle avant chaque opération :
 * pas de tenant → pas de requête.
 */
export function getTenantIdStrict(): Types.ObjectId {
  const id = getTenantIdOrNull();
  if (!id) {
    throw new InternalServerErrorException(
      'Contexte tenant absent : opération base de données refusée (fail-closed). ' +
        "Toute requête doit s'exécuter dans un contexte tenant — via le " +
        'TenantInterceptor (HTTP) ou runWithTenant() (scripts, tâches, tests).',
    );
  }
  return new Types.ObjectId(id);
}
