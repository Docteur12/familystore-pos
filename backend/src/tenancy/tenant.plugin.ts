/**
 * Plugin Mongoose de cloisonnement par tenant — la clé de voûte du multi-tenant.
 *
 * Appliqué à un schéma, il :
 *  1. ajoute un champ `tenant` (ObjectId, indexé, requis) ;
 *  2. réécrit AUTOMATIQUEMENT toute lecture/écriture pour la restreindre au
 *     tenant courant (find, findOne, update*, delete*, count, distinct…) ;
 *  3. renseigne `tenant` sur toute création (save, insertMany) ;
 *  4. injecte un `$match { tenant }` EN TÊTE de chaque pipeline d'agrégation.
 *
 * Objectif : les ~208 opérations base de données existantes n'ont pas à être
 * modifiées une par une — le filtrage est transparent.
 *
 * FAIL-CLOSED : la résolution du tenant (getTenantIdStrict) lève si aucun
 * contexte n'est établi. Une requête sans tenant échoue, elle ne renvoie
 * jamais les données de tous les magasins.
 *
 * Opt-out : un schéma « plateforme » (Tenant, Plan…) qui ne doit PAS être
 * cloisonné se déclare avec l'option `{ skipTenant: true }` ; le plugin
 * s'efface alors pour lui.
 */
import { Schema, Types } from 'mongoose';
import { getTenantIdStrict } from './tenant-context';

/** Opérations de requête dont le filtre doit être restreint au tenant. */
const QUERY_OPS = [
  'count',
  'countDocuments',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'update',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'distinct',
] as const;

export function tenantPlugin(schema: Schema): void {
  // Un schéma peut refuser le cloisonnement (collections plateforme).
  if ((schema as any).options?.skipTenant) return;

  // 1. Le champ porteur du cloisonnement. Indexé car présent dans TOUTES les
  //    requêtes ; requis pour qu'aucun document ne puisse exister « hors sol ».
  schema.add({
    tenant: { type: Types.ObjectId, required: true, index: true },
  });

  // 2. Lectures et écritures par filtre : on ajoute { tenant } au where.
  //    `this` est la Query — this.getFilter() expose le filtre courant.
  const appliquerFiltreTenant = function (this: any) {
    const tenant = getTenantIdStrict();
    const filtre = this.getFilter();
    // Ne jamais écraser un filtre tenant déjà posé explicitement (rare, mais
    // on respecte l'appelant) ; sinon on impose le tenant courant.
    if (filtre.tenant === undefined) {
      this.setQuery({ ...filtre, tenant });
    }
  };
  for (const op of QUERY_OPS) {
    schema.pre(op as any, appliquerFiltreTenant);
  }

  // 3a. Création via save() : pose le tenant s'il manque. En 'validate' (et
  //     non 'save') pour être exécuté AVANT le contrôle `required` du champ —
  //     sinon la validation échoue avant que le tenant soit renseigné.
  schema.pre('validate', function (this: any) {
    if (this.tenant === undefined || this.tenant === null) {
      this.tenant = getTenantIdStrict();
    }
  });

  // 3b. Création en lot via insertMany() : pose le tenant sur chaque document.
  schema.pre('insertMany', function (next: (err?: Error) => void, docs: any[]) {
    try {
      const tenant = getTenantIdStrict();
      for (const doc of docs) {
        if (doc.tenant === undefined || doc.tenant === null) doc.tenant = tenant;
      }
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  // 4. Agrégation : le $match tenant est placé EN TÊTE du pipeline, avant tout
  //    $group/$lookup/$project — sinon un étage amont verrait les autres
  //    tenants et le filtrage arriverait trop tard (ou jamais).
  schema.pre('aggregate', function (this: any) {
    const tenant = getTenantIdStrict();
    this.pipeline().unshift({ $match: { tenant } });
  });
}
