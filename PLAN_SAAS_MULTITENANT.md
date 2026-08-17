# Plan d'implémentation — Passage en SaaS multi-tenant

**Projet :** Family Store POS
**Décision retenue :** instances dédiées conservées pour Family Store et Radiance Essentials ; le SaaS mutualisé n'accueille que les nouveaux clients.
**Stack :** NestJS 10 + Mongoose 7 (MongoDB) · React + Vite · Electron (desktop-caisse) · Render

---

## 1. Principe directeur : un seul codebase, deux modes

Le piège à éviter absolument : maintenir trois versions du logiciel (Family Store, Radiance, SaaS). C'est déjà commencé avec `radiance-pos`, et le coût de maintenance double à chaque client.

La solution : **le code devient multi-tenant partout**, et une variable d'environnement décide du mode de fonctionnement.

| Mode | `TENANT_MODE` | Comportement |
|---|---|---|
| Instance dédiée | `single` | Un tenant unique créé au démarrage, résolu automatiquement. Inscription et facturation désactivées. Aucun changement visible pour l'utilisateur. |
| SaaS mutualisé | `multi` | Tenant résolu depuis le JWT. Inscription self-service, plans, abonnements, suspension. |

Family Store et Radiance tournent en `single` sur leur propre base MongoDB. Ils reçoivent toutes les corrections et nouveautés sans jamais partager leurs données. Si un jour tu veux les basculer dans le SaaS, c'est un simple `mongodump` + réécriture du `tenant` — pas une réécriture du logiciel.

**Conséquence pour Radiance :** le thème noir & or, le bilinguisme FR/EN et la désactivation du module Partenaires doivent redescendre dans le codebase principal sous forme de **configuration de tenant** (`theme`, `langue`, `modules[]`), pas de fork. C'est du travail en plus au départ, mais c'est ce qui rend le SaaS vendable ensuite : chaque nouveau client choisit ses couleurs et ses modules sans une ligne de code.

---

## 2. Architecture technique du multi-tenant

### 2.1 Le mécanisme central

Trois pièces, et une seule règle : **aucun service métier ne doit jamais écrire `tenant` à la main.**

```
Requête HTTP
   │
   ├─▶ AuthGuard          → décode le JWT, en extrait tenantId
   │
   ├─▶ TenantInterceptor  → pousse tenantId dans le contexte CLS (AsyncLocalStorage)
   │
   └─▶ Service métier     → this.productModel.find({ category: 'X' })
                                  │
                                  └─▶ Plugin Mongoose → réécrit en
                                      { category: 'X', tenant: <id du CLS> }
```

Le filtrage est **automatique et invisible**. Les 208 appels Mongoose existants n'ont pas à être modifiés un par un — c'est ce qui rend le chantier réalisable sans tout casser.

Dépendance à ajouter : `nestjs-cls` (wrapper propre autour d'`AsyncLocalStorage` de Node).

### 2.2 Le plugin Mongoose — le fichier le plus important du projet

**Nouveau :** `backend/src/tenancy/tenant.plugin.ts`

```ts
// Applique le cloisonnement à TOUS les schémas métier.
// Toute requête sans tenant dans le contexte est REJETÉE (fail-closed) :
// mieux vaut une erreur 500 qu'une fuite de données entre deux boutiques.
export function tenantPlugin(schema: Schema, opts: { cls: ClsService }) {
  schema.add({ tenant: { type: Types.ObjectId, ref: 'Tenant', required: true, index: true } });

  const resolve = () => {
    const t = opts.cls.get('tenantId');
    if (!t) throw new InternalServerErrorException('Contexte tenant absent');
    return new Types.ObjectId(t);
  };

  // Lectures / écritures par filtre
  const QUERY_OPS = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
    'count', 'countDocuments', 'distinct', 'updateOne', 'updateMany',
    'deleteOne', 'deleteMany', 'replaceOne',
  ];
  schema.pre(QUERY_OPS, function () { this.where({ tenant: resolve() }); });

  // Créations
  schema.pre('save',       function ()      { if (!this.tenant) this.tenant = resolve(); });
  schema.pre('insertMany', function (_n, docs) { docs.forEach(d => d.tenant = resolve()); });

  // Agrégations — 10 pipelines existants (auth, ecarts, factures, fournisseurs, sales)
  schema.pre('aggregate',  function () { this.pipeline().unshift({ $match: { tenant: resolve() } }); });
}
```

**Le point de vigilance absolu :** `updateMany` et `deleteMany` sans filtre tenant effaceraient les données de tous les clients. Le plugin les couvre, mais toute nouvelle opération devra passer par un `Model` — jamais par `connection.collection(...)` en direct, qui **contourne les plugins**.

### 2.3 Contexte et résolution du tenant

| Fichier | Nature | Rôle |
|---|---|---|
| `backend/src/tenancy/tenancy.module.ts` | nouveau | Module `@Global`, configure `ClsModule` |
| `backend/src/tenancy/tenant.interceptor.ts` | nouveau | Injecte `tenantId` dans le CLS depuis `req.user` |
| `backend/src/tenancy/tenant.context.ts` | nouveau | Helper `runWithTenant()` pour scripts, crons et webhooks (hors requête HTTP) |
| `backend/src/tenancy/single-tenant.bootstrap.ts` | nouveau | Mode `single` : crée/charge le tenant unique au démarrage |

### 2.4 Index uniques — à reprendre un par un

Chaque contrainte d'unicité actuelle est **globale**. En SaaS, deux boutiques différentes doivent pouvoir avoir un produit avec le même code-barres. Toutes deviennent composites.

| Fichier | Contrainte actuelle | Devient |
|---|---|---|
| [caisse.schema.ts:11](backend/src/schemas/caisse.schema.ts#L11) | `code` unique | `{ tenant, code }` |
| [product.schema.ts:14](backend/src/schemas/product.schema.ts#L14) | code-barres unique sparse | `{ tenant, barcode }` |
| [category.schema.ts:18](backend/src/schemas/category.schema.ts#L18) | `{ category, subCategory }` | `{ tenant, category, subCategory }` |
| [sale.schema.ts:102](backend/src/schemas/sale.schema.ts#L102) | n° facture unique sparse | `{ tenant, numero }` |
| [reception.schema.ts:25](backend/src/schemas/reception.schema.ts#L25) | référence unique sparse | `{ tenant, reference }` |
| [stock-movement.schema.ts:37](backend/src/schemas/stock-movement.schema.ts#L37) | référence unique sparse | `{ tenant, reference }` |
| [stock-snapshot.schema.ts:11](backend/src/schemas/stock-snapshot.schema.ts#L11) | clé unique | `{ tenant, cle }` |
| [livraison-partenaire.schema.ts:63](backend/src/schemas/livraison-partenaire.schema.ts#L63) | `idempotencyKey` | `{ tenant, idempotencyKey }` |
| [user.schema.ts:11](backend/src/schemas/user.schema.ts#L11) | `email` unique | **reste globalement unique** — voir ci-dessous |

**Décision à assumer sur l'email.** Deux options :

- **Email globalement unique** (recommandé) : un email = un compte = une boutique. Le login reste exactement ce qu'il est aujourd'hui, l'utilisateur tape email + mot de passe, le backend retrouve le tenant. Zéro friction. Limite : une personne qui gère deux boutiques a besoin de deux adresses.
- Email unique par tenant : impose de demander un code boutique ou un sous-domaine à la connexion. Plus souple, plus lourd pour l'utilisateur.

Le POS est utilisé par des caissiers pressés sur une caisse physique. **Le login doit rester à deux champs.** Recommandation : email globalement unique, quitte à assouplir plus tard si un client le demande vraiment.

### 2.5 Collections hors tenant

Ces schémas ne reçoivent **pas** le plugin — ce sont les données de la plateforme, pas d'une boutique :

`Tenant` · `Plan` · `Subscription` · `Invoice` (facture d'abonnement) · `Payment` · `SuperAdmin`

Attention à ne pas confondre `Invoice` (ce que **tes clients te paient**) avec le `Facture` existant (ce que **leurs clients leur paient**). Nommer le nouveau schéma `AbonnementFacture` évite des heures de confusion.

---

## 3. Les fichiers à modifier — inventaire complet

### 3.1 Backend — schémas (23 fichiers)

Tous les fichiers de `backend/src/schemas/` reçoivent le plugin, sauf les nouveaux schémas plateforme. L'ajout du champ `tenant` se fait **par le plugin**, pas à la main dans chaque fichier — seuls les index uniques listés en 2.4 demandent une édition manuelle (9 fichiers).

### 3.2 Backend — modules (18 fichiers)

Chaque `MongooseModule.forFeature([...])` doit enregistrer les schémas **après** application du plugin. Deux stratégies :

- **Globale (recommandée)** : appliquer le plugin dans `app.module.ts` via `connection.plugin(...)` conditionné par une liste d'exclusion. Un seul point de contrôle, aucun module à modifier.
- Par module : `forFeatureAsync` avec `useFactory`. 18 fichiers à réécrire, plus verbeux, mais explicite.

Je recommande la globale, avec la liste d'exclusion en dur et commentée dans `tenancy.module.ts`.

### 3.3 Backend — fichiers à réécrire réellement

| Fichier | Modification |
|---|---|
| [app.module.ts](backend/src/app.module.ts) | Importer `TenancyModule` + `BillingModule` + `PlatformModule` ; appliquer le plugin sur la connexion |
| [main.ts](backend/src/main.ts) | Bootstrap du tenant en mode `single` ; CORS restreint aux domaines clients |
| [auth.service.ts](backend/src/auth/auth.service.ts) | `login` → résoudre le tenant, le mettre dans le JWT, vérifier que l'abonnement est actif · `register` → rattacher au tenant courant · `forgotPassword` → email au nom de la boutique, pas « Family Store POS » en dur (ligne 182) |
| [auth.guard.ts](backend/src/auth/auth.guard.ts) | Exposer `tenantId` sur `request.user` |
| [roles.guard.ts](backend/src/auth/roles.guard.ts) | Ajouter le rôle plateforme `superadmin` |
| [settings.service.ts](backend/src/settings/settings.service.ts) | Le singleton `findOne({})` devient un singleton **par tenant** — le plugin s'en charge, mais l'`upsert` ligne 22 doit être vérifié |
| [settings.schema.ts](backend/src/settings/settings.schema.ts) | Ajouter `theme`, `modules[]` pour absorber la personnalisation Radiance |
| [audit.service.ts](backend/src/audit/audit.service.ts) | Vérifier que les logs écrits hors requête HTTP passent par `runWithTenant()` |
| [seeds/seed.ts](backend/seeds/seed.ts) | Devient un seed **par tenant**, réutilisé à chaque inscription |

### 3.4 Backend — nouveaux modules

```
backend/src/tenancy/          tenant.plugin.ts · tenant.interceptor.ts · tenant.context.ts
                              tenancy.module.ts · single-tenant.bootstrap.ts
backend/src/platform/         tenant.schema.ts · superadmin.schema.ts
                              platform.controller.ts · platform.service.ts   (back-office toi)
backend/src/billing/          plan.schema.ts · subscription.schema.ts
                              abonnement-facture.schema.ts · payment.schema.ts
                              billing.service.ts · billing.controller.ts
                              payment-provider.interface.ts
                              providers/cinetpay.provider.ts (ou notchpay / flutterwave)
                              webhooks.controller.ts
                              subscription.guard.ts       ← bloque l'accès si abonnement expiré
                              billing.cron.ts             ← relances J-7, suspension J+7
backend/src/onboarding/       signup.controller.ts · provisioning.service.ts
```

### 3.5 Frontend (87 fichiers, mais peu d'impact)

Le frontend n'a **presque rien à changer** : le tenant vit dans le JWT, les 20 fichiers de `frontend/src/api/` continuent d'appeler les mêmes routes.

| Fichier | Modification |
|---|---|
| [api/http.ts](frontend/src/api/http.ts) | Rien si le token porte déjà le tenant |
| [api/fetchInterceptor.ts](frontend/src/api/fetchInterceptor.ts) | Intercepter le `402 Payment Required` → rediriger vers la page d'abonnement |
| [contexts/SettingsContext.tsx](frontend/src/contexts/SettingsContext.tsx) | Charger thème + modules actifs du tenant |
| [App.tsx](frontend/src/App.tsx) | Routes `/inscription`, `/abonnement`, `/plateforme/*` ; masquer les routes des modules non souscrits |
| `pages/Signup.tsx` | **nouveau** — inscription en 3 champs |
| `pages/Abonnement.tsx` | **nouveau** — plan, échéance, historique, bouton payer |
| `pages/PlateformeAdmin.tsx` | **nouveau** — ton back-office |
| [pages/Login.tsx](frontend/src/pages/Login.tsx) | Lien « Créer ma boutique » (mode `multi` uniquement) |

### 3.6 Desktop-caisse (Electron)

[desktop-caisse/main.js](desktop-caisse/main.js) pointe aujourd'hui vers une URL fixe. En SaaS il faut un écran de configuration au premier lancement (URL serveur + identifiants), stocké localement. Le `offline.html` reste tel quel.

---

## 4. Modèle de facturation

### 4.1 Schémas

```ts
Tenant       { nom, slug, statut: essai|actif|suspendu|resilie,
               plan, expireLe, theme, modules[], creeLe }
Plan         { code, nom, prixMensuel, prixAnnuel, devise: 'XAF',
               limites: { caisses, utilisateurs }, modules[] }
Subscription { tenant, plan, cycle: mensuel|annuel, debut, fin,
               renouvellementAuto, statut }
Payment      { tenant, montant, provider, providerRef, statut, payeLe }
```

### 4.2 Cycle de vie

```
Inscription ──▶ ESSAI (14 j) ──▶ paiement ──▶ ACTIF
                    │                            │
                    │                       J-7 : facture + notification
                    │                            │
                    └──▶ expiré ──────────▶ SUSPENDU (lecture seule)
                                                 │
                                            J+30 : archivé (jamais supprimé)
```

**Le mode suspendu est en lecture seule, pas un blocage total.** Un commerçant qui a 3 mois de ventes dans le logiciel doit toujours pouvoir consulter et exporter ses données, même impayé. C'est une question de confiance — et paradoxalement, ça fait payer plus de monde qu'un mur.

Implémentation : `SubscriptionGuard` global qui laisse passer les `GET` et rejette les autres verbes en `402`.

### 4.3 Paiement

Interface `PaymentProvider` avec une seule implémentation au départ (CinetPay ou Notch Pay — Mobile Money MTN/Orange). Le point critique reste que **le Mobile Money ne fait pas de prélèvement récurrent fiable** : le renouvellement est donc semi-manuel (notification → lien de paiement → webhook → prolongation). L'abonnement annuel réduit ce frottement à une fois par an, d'où l'intérêt de le remiser de 15 à 20 %.

Le webhook `POST /api/billing/webhook/:provider` est **public et non authentifié** : signature du provider vérifiée obligatoirement, et exécution dans `runWithTenant()` puisqu'il n'y a pas de JWT.

---

## 5. Migration des données existantes

Les instances Family Store et Radiance tournent déjà en production. Le passage au code multi-tenant impose un backfill : **chaque document existant doit recevoir un `tenant`**, sinon le plugin (fail-closed) les rend invisibles.

**Nouveau script :** `backend/scripts/migrate-add-tenant.js`

```
1. Sauvegarde complète         mongodump  ← obligatoire, non négociable
2. Créer le document Tenant    { nom: 'Family Store', statut: 'actif', plan: 'illimite' }
3. Pour chacune des 23 collections :
     updateMany({ tenant: { $exists: false } }, { $set: { tenant: <id> } })
4. Supprimer les anciens index uniques globaux
5. Laisser Mongoose recréer les index composites au démarrage
6. Vérifier : countDocuments({ tenant: { $exists: false } }) === 0 partout
```

**Ordre de déploiement impératif :**

```
backup → script de migration (ancien code encore en ligne) → déploiement du nouveau code
```

L'inverse — déployer d'abord — rend l'application aveugle à toutes les données pendant la migration. Sur un POS en heure d'ouverture, c'est une boutique à l'arrêt.

**Fenêtre :** en dehors des heures de vente. Prévoir un `migrate-rollback.js` qui retire le champ `tenant` et restaure les index d'origine.

---

## 6. Sécurité — le risque n°1

Une fuite inter-tenant sur un logiciel de caisse, c'est un commerçant qui voit le chiffre d'affaires de son concurrent. C'est fatal commercialement.

| Garde-fou | Détail |
|---|---|
| Fail-closed | Pas de tenant dans le contexte → exception, jamais de requête non filtrée |
| Interdiction | Aucun accès direct via `connection.collection()` — contourne les plugins |
| Tests automatisés | Suite dédiée : créer 2 tenants, peupler, vérifier l'isolation sur **chaque** route |
| Revue ciblée | Les 10 `aggregate` et les 33 `populate` — le `populate` ne re-filtre pas par défaut |
| Vérification d'ID | Toute route `/:id` doit renvoyer 404 (pas 403) si l'objet appartient à un autre tenant |
| Rate limiting | `@nestjs/throttler` sur `/api/auth/*` et l'inscription |

Le cas des **33 `populate`** mérite une attention particulière : ils traversent les références (`caisseId`, `partenaire`, `fournisseur`…). Le plugin s'applique bien aux requêtes de populate, mais chaque cas doit être vérifié explicitement, en particulier les 12 de `magazinier.service.ts` et les 9 de `partenaires.service.ts`.

---

## 7. Découpage en lots

| # | Lot | Contenu | Durée |
|---|---|---|---|
| 1 | Socle tenancy | CLS, plugin, interceptor, mode `single`, index composites, script de migration | 5–7 j |
| 2 | Bascule des instances | Family Store + Radiance migrés en `single`, en production, sans changement visible | 2–3 j |
| 3 | Absorption Radiance | Thème + langue + modules deviennent config tenant, fin du fork | 4–5 j |
| 4 | Plateforme | Schémas `Tenant`/`Plan`, back-office superadmin, provisioning | 5–6 j |
| 5 | Facturation | Abonnements, provider Mobile Money, webhooks, `SubscriptionGuard`, crons | 6–8 j |
| 6 | Onboarding | Inscription, essai 14 j, seed automatique, emails | 3–4 j |
| 7 | Sécurité & tests | Suite d'isolation, revue `aggregate`/`populate`, rate limiting | 4–5 j |
| | | **Total** | **29–38 j ouvrés (~6 à 8 semaines)** |

Les lots 1 et 2 ont une valeur immédiate même si tu abandonnes le SaaS ensuite : ils suppriment le fork Radiance et donc la double maintenance.

---

## 8. Ce qui reste à décider avant de commencer

1. **Prestataire de paiement** — CinetPay, Notch Pay ou Flutterwave. Vérifier les frais réels sur Mobile Money (souvent 2,5 à 3,5 %) et le délai de reversement.
2. **Grille tarifaire** — nombre de plans, prix mensuel/annuel en FCFA, ce qui est bridé (caisses ? utilisateurs ? module Partenaires ?).
3. **Durée de l'essai** — 14 jours (crée l'urgence) ou 30 jours (le temps d'un cycle de vente complet).
4. **Nom commercial** — « Family Store POS » est le nom d'un client, pas d'un produit SaaS. Il apparaît en dur dans le code (emails, PDF, `package.json`) et devra être neutralisé.

---

*Document généré le 3 août 2026 — à relire après décision sur les points de la section 8.*
