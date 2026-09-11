# Caméléon — la gamme (Commerce · Snack-bar · Restaurant · Hôtel/meublé)

Document d'orientation pour les sessions qui construiront les nouveaux profils
métier. Écrit le 11/09/2026 par la session référente, à partir d'une lecture
complète du dépôt sur `integration/cameleon` (`d4ac4dc5`). Il se lit **après**
`CLAUDE.md` et **avant** la première ligne de code.

Trois règles de fond, non négociables, posées par Valdes :

1. **UN SEUL CODE, ce dépôt.** Un profil métier = un `typeEtablissement` sur
   la boutique, un jeu de modules préréglés, un écran principal adapté, un
   vocabulaire. Jamais un fork, jamais un second dépôt.
2. **Commerce ne change pas d'un iota.** La suite de tests existante reste
   verte **sans modification** : c'est le critère de merge de chaque branche
   verticale. Au 11/09/2026 elle compte **295 tests backend (37 fichiers)** et
   **120 tests frontend (17 fichiers)**. Si un test existant doit changer pour
   que votre branche passe, c'est votre branche qui a tort.
3. **Paiement MANUEL.** Pas de MyCoolPay. Valdes est le superadmin : il crée
   les boutiques, active, prolonge et suspend les licences depuis
   `/admin/boutiques`. Les nouveaux clients sont des **tenants** du service
   Caméléon en mode `multi`.

---

## 1. Architecture partagée — ce que chaque session réutilise sans y toucher

Chaque rubrique : où c'est, comment on s'y branche, ce qu'on ne modifie pas.

### 1.1 Tenancy fail-closed

**Où.** `backend/src/tenancy/` — `tenant-context.ts` (`runWithTenant`,
`DEFAULT_TENANT_ID`, `getTenantMode`, `getTenantIdStrict`), `tenant.plugin.ts`
(filtre toutes les opérations Mongoose, `pre('aggregate')` injecte le `$match`
en tête), `tenant.interceptor.ts` (mode single → tenant par défaut, mode multi →
`req.user.tenantId`). Le plugin est posé **une fois sur la connexion** dans
`app.module.ts` (`connectionFactory`).

**Comment on s'y branche.** Automatiquement. Tout nouveau schéma Mongoose
compilé par un module Nest reçoit le champ `tenant` et le filtrage. Rien à
écrire. Pour du code hors requête HTTP (cron, script), envelopper dans
`runWithTenant(tenantId, async () => model.find().exec())` — une Query
Mongoose est paresseuse, sans `exec()` ou `await` à l'intérieur elle sort du
contexte et lève.

**Ce qu'on ne modifie pas.**
- `DEFAULT_TENANT_ID` s'importe, ne se réécrit jamais en littéral.
- `skipTenant` (option de schéma **ou** de requête) : interdit dans tout
  `*.service.ts` / `*.controller.ts` sauf la dérogation nommée
  `auth/auth.service.ts` ; toute activation porte `// SKIP-TENANT: <raison>`
  sur la même ligne. Verrouillé par `test/tenancy/skip-tenant-governance.spec.ts`.
- Jamais de `connection.collection(...)` ni `db.collection(...)` dans le code
  métier (`test/tenancy/admin-reset.spec.ts`).
- Un `$lookup` ne joint que par `_id` : le `$match` du plugin ne protège que la
  collection source.
- `test/tenancy/isolation-routes.e2e.spec.ts` balaie **toutes** les routes GET
  en mode multi avec deux boutiques : toute nouvelle route GET que vous ajoutez
  y passera. Elle doit répondre 200 pour un jeton A sans laisser passer une
  donnée de B.

### 1.2 Plateforme : propriétaire, boutique, licence

**Où.** `backend/src/platform/` — `schemas/proprietaire.schema.ts` (e-mail
unique **global**), `schemas/boutique.schema.ts` (`nom`, `ville`, `tenantId`
unique, `proprietaire`, `statut: active | suspendue`), `schemas/licence.schema.ts`
(`dateEcheance` = dernier jour couvert, `MONTANT_LICENCE_ANNUELLE = 120_000`),
`provisionnement.service.ts` (`creerBoutique` : registre + licence d'un an +
**dans le tenant neuf** `Settings.create({nomMagasin, ville})` et le `User`
patron), `licence.interceptor.ts` (licence expirée → **lecture seule**, 402
sur les écritures, jamais coupure ; la synchro hors-ligne datée pendant la
couverture passe encore).

**Comment on s'y branche.** On ne s'y branche pas : on **lit** `etatLicence`
si besoin, on ne crée jamais de boutique ailleurs que par
`ProvisionnementService.creerBoutique`. Le socle profil (section 2) est le seul
chantier autorisé à toucher `creerBoutique` (pour poser le type).

**Ce qu'on ne modifie pas.** La traversée des boutiques se fait **en entrant
dans un contexte** (`runWithTenant`), jamais en retirant la barrière. Le compte
propriétaire est une **clé maîtresse** (voir CLAUDE.md) : ne pas ajouter de
route qui liste ou modifie les boutiques d'un propriétaire sans `@Roles`.

### 1.3 Back-office superadmin et licences manuelles

**Où.** `platform.controller.ts` (`@Roles('superadmin')` au niveau classe) :
`GET /platform/boutiques`, `POST /platform/boutiques`,
`PATCH /platform/boutiques/:id/statut`, `POST /platform/boutiques/:id/prolonger`
(corps `{montant, moyen, note}` → un `Paiement` confirmé source `manuel`, puis
licence +1 an), `GET /platform/boutiques/:id/paiements`. Frontend :
`pages/AdminBoutiques.tsx`, `api/plateforme.ts`, `utils/plateforme.ts`.
Mode de paiement : `platform/paiement/choisir-prestataire.ts` — `manuel` par
défaut, `simule` interdit en production, valeur inconnue = refus de démarrer.
Contact affiché aux commerçants : `platform/contact-licence.ts`
(`CONTACT_LICENCE`, défaut `+237 6 74 63 54 11`), repris par
`GET /licence/etat`, le 402, les relances e-mail et le bandeau
`components/BandeauLicence.tsx`.

**Comment on s'y branche.** Un profil n'a rien à y faire. La licence est par
boutique, indépendante du métier. Si un profil facture autrement (par chambre,
par table), **ce n'est pas le sujet de la licence** : la licence reste
annuelle, plein tarif, activée par Valdes.

**Ce qu'on ne modifie pas.** `PaiementService.annoncer()` est le point d'entrée
unique de tout changement de statut d'un paiement ; `MOYENS_REGLEMENT` est un
miroir front/back verrouillé (`api/plateforme-governance.spec.ts`). Aucun
bouton « payer en ligne » ne doit réapparaître quand
`paiementEnLigne === false` : afficher le contact (`consigneRenouvellement`).

### 1.4 Sélecteur multi-établissements et rapport consolidé

**Où.** `components/SelecteurBoutique.tsx` (liste autorisée = `boutiques` du
jeton, noms via `GET /consolide/boutiques`, bascule via
`services/session.ts › basculerVersBoutique` qui prévient si des files
hors-ligne seraient perdues). Backend `consolide/consolide.service.ts` :
agrège **`Sale` uniquement** (`createdAt`, `total`) boutique par boutique sous
`runWithTenant`, en lecture seule (`test/tenancy/consolide-lecture-seule.spec.ts`
échoue si une méthode d'écriture y apparaît). Frontend
`pages/RapportConsolide.tsx` (en-tête sombre, distinct d'un rapport de boutique).

**Comment on s'y branche.** Par la donnée, pas par le code : **tout
encaissement de tout profil produit un document `Sale`** (voir 1.9). Ainsi le
consolidé, la comptabilité, les exports et la licence voient un restaurant ou
un hôtel comme ils voient une boutique. Le socle (section 2) ajoute la colonne
« type » et un sous-total par type ; c'est le seul changement prévu ici.

**Ce qu'on ne modifie pas.** Le périmètre est **borné au jeton**
(`req.user.boutiques`), jamais élargi ; aucune écriture n'est exposée par
`consolide/`.

### 1.5 Stockage local cloisonné et hors-ligne

**Où.** `frontend/src/services/storage.ts` — couche unique : toute clé de
données est `cam:<boutiqueId>:<cle>` ; accès sans boutique active → **lève**
(`exigerBoutiqueActive`) ; `CLES_GLOBALES` (`app_lang`, `fs_print_settings`)
est une liste **fermée** de réglages d'appareil ; chaque boutique a **son**
jeton (`jeton()`, `jetonDeBoutique`, `definirJeton`). Files hors-ligne :
`services/offlineSync.ts` (ventes, `PendingSale` estampillée `boutiqueId`,
`idempotencyKey` réutilisée sur tous les chemins de repli, seconde barrière à
la synchro) et `services/offlineMagazin.ts` (produits, réceptions, ajouts,
ajustements). Carte des files : `services/session.ts › CLES_FILES`.

**Comment on s'y branche.** `lireJson/ecrireJson` ou `idbLire/idbEcrire`
depuis `services/storage.ts`, et **rien d'autre**. Une nouvelle file hors-ligne
(commandes en salle, réservations) s'ajoute à `CLES_FILES` pour être comptée
et purgée avec les autres à la déconnexion ou à la bascule.

**Ce qu'on ne modifie pas.** Aucun `localStorage.` / `sessionStorage.` /
`idb-keyval` hors de la couche (`services/storage-governance.spec.ts`, dérogation
par `// STORAGE-DIRECT: <raison>`). On ne perd jamais une vente en silence :
confirmation **avant** purge (`deconnexion`, `messagePerteFiles`).

### 1.6 Settings, modules optionnels, règles métier

**Où.** `backend/src/settings/settings.schema.ts` : identité (`nomMagasin`,
`logoUrl`, couleurs, `langue`), identité imprimée (`slogan`, `signatureTicket`,
`mentionsLegales`, `telephonesTicket`), `modules: string[]` (**vide = tout
actif** ; « rien » s'écrit `['aucun']`), `metier {inactiviteMinutes,
seedFournisseursDemo, suiviPeremption}`, `offreFacture`.
`MODULES_DISPONIBLES = ['partenaires', 'factures-fournisseurs']` — **miroir**
de `frontend/src/api/settings.ts` (`modules-governance.spec.ts` lit les deux
sources). Frontend : `useSettings().hasModule(id)`, `RequireModule` dans
`App.tsx`, champ `module?: ModuleId` sur les items de `AdminSidebar.tsx` et
`StocksSidebar.tsx`.

**Comment on s'y branche.** C'est **le point d'ancrage des profils** : un
profil active un jeu de modules (section 2.2). Un nouveau module s'ajoute
**des deux côtés en même temps**, avec un libellé lisible côté frontend, sa
route sous `RequireModule`, son item de menu avec `module:`.

**Ce qu'on ne modifie pas.** Les défauts neutres : `nomMagasin` vide,
`couleurPrincipale` vert Caméléon, `offreFacture` vide (« une offre inventée
engage »). `GET /settings/public` répond neutre en multi (`{ mode: 'multi' }`)
et l'écran de connexion reste Caméléon dans ce mode
(`utils/identite-connexion.ts`) — ne pas y afficher une enseigne.

### 1.7 i18n, marque, nomenclature

**Où.** `frontend/src/i18n/index.ts` : `t('fr', 'en')` inline, pas de
catalogue ; `dateLocale()` ; la langue est un réglage d'**appareil**.
`i18n/backend-messages.ts` : le backend reste **monolingue FR**, ses messages
d'exception sont traduits côté client — **chaque nouveau message d'exception
s'ajoute là**. Marque : `config/marque.ts` (`MARQUE_PRODUIT = 'Caméléon'`,
`nomEnseigne()`) ; repli des tickets **vide** (`STORE_FALLBACK` dans
`ReceiptPrint.tsx`). Noms de produits : `displayName()` (front) /
`nomProduit()` (back), miroirs.

**Comment on s'y branche.** Toute chaîne visible passe par `t()`. Tout nom de
produit, plat ou chambre affiché passe par `displayName()`.

**Ce qu'on ne modifie pas.** Aucun littéral d'enseigne de client dans le code
livré (`marque-governance.spec.ts` des deux côtés ; les commentaires JSX
multi-lignes comptent comme du code à partir de la deuxième ligne — écrire
« les boutiques existantes », pas leurs noms).

### 1.8 Gouvernance — l'idiome, et la liste

Huit tests lisent les **sources** et refusent une dérive silencieuse :

| Test | Règle |
|---|---|
| `backend/test/tenancy/skip-tenant-governance.spec.ts` | `skipTenant` justifié et hors services/contrôleurs |
| `backend/test/marque-governance.spec.ts` | pas d'enseigne de client en dur (backend) |
| `frontend/src/config/marque-governance.spec.ts` | idem frontend |
| `frontend/src/services/storage-governance.spec.ts` | stockage local uniquement via la couche |
| `frontend/src/api/modules-governance.spec.ts` | `MODULES_DISPONIBLES` miroir front/back |
| `frontend/src/api/plateforme-governance.spec.ts` | `MOYENS_REGLEMENT` miroir front/back |
| `frontend/src/pages/motifs-stock-governance.spec.ts` | tout motif de `MOVEMENT_REASONS` a un libellé FR **et** EN dans `Stocks.tsx`, listes identiques |
| `frontend/src/components/tiroir-caisse-governance.spec.ts` | pas d'ouverture de tiroir par `navigator.serial` |

**L'idiome à reproduire** pour toute nouvelle règle : lire les fichiers avec
`fs` (jamais importer le module), `portionCode(ligne)` qui ignore les
commentaires, un marqueur de justification `// <MARQUEUR>: <raison>` sur la
même ligne, des exemptions **nominatives**, et un **méta-test** qui prouve que
le détecteur détecte (une regex cassée rendrait la règle muette).

**Piège CI.** `.github/workflows/ci.yml` ne lance **pas** `npm test` côté
frontend (commentaire périmé « le frontend n'a pas encore de tests »). Les
gouvernances frontend, dont celles qui lisent les sources **backend**, ne
tournent donc qu'en local. Le socle corrige ça (S0). Jusque-là : `npm test`
dans `frontend/` avant tout push, systématiquement.

### 1.9 Le modèle de vente : « une vente = un ticket fermé »

**Où.** `backend/src/schemas/sale.schema.ts` : `items[{product?, name,
quantity, unitPrice, discount, originalPrice, divers}]`, `total`, `subtotal`,
`offrePct/offreAmt`, `paymentMethod ∈ {cash, mtn_momo, orange_money, card,
mobile_money, credit}`, `amountPaid`, `change`, `cashierName/Email`,
`caisseName`, `sessionId` (chaîne libre), `idempotencyKey` (index partiel par
tenant), `dateVente` (synchro hors-ligne), `modifications[]` (corrections ≤ 30 j).
`sales.service.ts › create()` : idempotence → vérification de stock des lignes
non `divers` (sauf `forceVente`, qui ouvre un `EcartStock`) → création →
décrément `stock` + `StockMovement {OUT, sale}` → alertes. **Aucun champ de
statut, aucun panier serveur, aucune transaction Mongo.** L'invariant n'est
codé nulle part : il **découle de l'absence d'état**.

**Comment on s'y branche.** C'est la décision structurante de la gamme :
**chaque encaissement de chaque profil crée un `Sale` par
`SalesService.create()`**, avec une `idempotencyKey` dérivée de l'objet métier
(`addition:<id>`, `sejour:<id>:acompte`). Ce qui est « ouvert » (une addition,
un séjour) vit dans **une collection du profil**, et se **ferme** en un `Sale`.
Résultat : consolidé, comptabilité, exports, factures archivées, licence,
audit et file hors-ligne fonctionnent sans une ligne de plus.

**Ce qu'on ne modifie pas.** `SalesService.create()`, hors le point unique
prévu par le socle (2.3, `stockSuivi`). Pas de champ `statut` sur `Sale`. Pas
de suppression logique là où il y a suppression physique aujourd'hui.

### 1.10 Ce qui n'existe pas (à ne pas chercher)

Panier ou commande serveur · tables, salle, couverts, additions partagées ·
envoi cuisine, statut de ligne · recettes / ingrédients · chambres,
réservations, séjours, acomptes, ménage · consignes, casiers, conditionnement
multiple (`unit = 'bouteille'` existe, `casier` non) · retours clients, avoirs,
remboursements (seulement correction ≤ 30 j et suppression physique) · fond de
caisse et écart de caisse à la fermeture (une `Session` ne porte que
`dateDebut/dateFin/nbVentes/totalEncaisse`) · dépôts en base
(`StocksDepots.tsx` est du stockage local) · commandes fournisseurs · client
identifié sur une vente · transaction Mongo autour vente + stock.

### 1.11 Le précédent à imiter : le module `partenaires`

Dépôt-vente livré depuis l'entrepôt. Nouveau module Nest
(`backend/src/partenaires/`), nouvelles collections (`partenaire`, `agence`,
`commande-partenaire`, `livraison-partenaire`, `paiement-partenaire`,
`retour-partenaire`), deux motifs de stock ajoutés des deux côtés
(`livraison_partenaire`, `retour_partenaire`), un rôle (`commercial`), une
route `RequireModule`, un item de menu `module: 'partenaires'`, un écran à
navigation interne (`pages/Partenaires.tsx`). **Sans toucher au noyau de
vente.** C'est exactement la forme d'un profil.

---

## 2. Le socle « profil métier » — construit par la session référente

Les verticaux démarrent en parallèle sur leurs fichiers propres (section 5),
mais **aucun fichier partagé ne bouge avant que ce socle soit mergé** sur
`integration/cameleon`, poussé, et le signal donné (`socleMerge: true`). Il
touche les fichiers partagés que chaque vertical aurait dû toucher : les
toucher une fois, ici, évite trois rebases douloureux.

### 2.1 S0 — CI complète et gouvernance mécanique du périmètre

Trois pièces, livrées **en premier** (jour 1 du socle), parce que les
sessions parallèles en dépendent :

1. **`ci.yml` : `npm test` au job frontend.** Retirer le commentaire périmé.
   Sans ça, les gouvernances frontend ne protègent personne en CI.
2. **`cameleon-perimetres.json`** à la racine — la carte de qui touche quoi :

   ```json
   {
     "socleMerge": false,
     "partages": [
       "frontend/src/App.tsx", "frontend/src/components/AdminSidebar.tsx",
       "frontend/src/components/StocksSidebar.tsx", "frontend/src/i18n/backend-messages.ts",
       "frontend/src/pages/Stocks.tsx", "frontend/src/services/session.ts",
       "backend/src/app.module.ts", "backend/src/schemas/stock-movement.schema.ts",
       "backend/src/schemas/product.schema.ts", "backend/src/schemas/user.schema.ts"
     ],
     "profils": {
       "snack":      { "branche": "feat/cameleon-snack",
                       "propres": ["backend/src/comptoir/**", "backend/test/comptoir/**",
                                   "frontend/src/pages/Comptoir*.tsx", "frontend/src/pages/StocksReserve*.tsx",
                                   "frontend/src/api/comptoir.ts", "frontend/src/utils/comptoir*.ts",
                                   "frontend/src/components/comptoir/**"] },
       "restaurant": { "branche": "feat/cameleon-restaurant",
                       "propres": ["backend/src/salle/**", "backend/test/salle/**",
                                   "frontend/src/pages/Salle*.tsx", "frontend/src/pages/Cuisine*.tsx",
                                   "frontend/src/pages/StocksRecettes*.tsx", "frontend/src/pages/AdminAdditions*.tsx",
                                   "frontend/src/api/salle.ts", "frontend/src/utils/salle*.ts",
                                   "frontend/src/components/salle/**"] },
       "hotel":      { "branche": "feat/cameleon-hotel",
                       "propres": ["backend/src/hotel/**", "backend/test/hotel/**",
                                   "frontend/src/pages/Reception*.tsx", "frontend/src/pages/Calendrier*.tsx",
                                   "frontend/src/pages/Menage*.tsx", "frontend/src/pages/AdminChambres*.tsx",
                                   "frontend/src/api/hotel.ts", "frontend/src/utils/hotel*.ts",
                                   "frontend/src/components/hotel/**"] }
     }
   }
   ```

   Règle : une branche `feat/cameleon-<profil>` ne modifie que ses `propres`
   tant que `socleMerge` vaut `false`. Quand la référente merge le socle, elle
   passe `socleMerge` à `true` dans le même commit : c'est **le signal**. Après
   rebase, la branche peut toucher aux `partages` — **de façon additive**
   (ajouter des lignes, jamais en retirer ni en réécrire). Tout autre fichier
   reste interdit : un besoin hors périmètre se demande à la référente, qui
   l'ajoute au socle ou au JSON pour tout le monde.
3. **`backend/scripts/verifier-perimetre.ts`** (`npm run verifier:perimetre --
   --profil=snack`) : calcule `git merge-base origin/integration/cameleon HEAD`,
   liste les fichiers modifiés depuis, et **échoue** si l'un d'eux est hors
   `propres` (ou hors `propres ∪ partages` quand `socleMerge` est vrai), ou si
   un fichier de `partages` a des lignes **supprimées**. Il vérifie aussi que
   **Commerce est intact** : aucun `*.spec.ts` existant au merge-base n'a
   changé (`git diff --stat <base> HEAD -- <liste des specs du base>` vide).
   Un job CI « Périmètre » le lance sur toute branche `feat/cameleon-*` et sur
   chaque PR vers `integration/cameleon` (`fetch-depth: 0`) ; le profil est
   déduit du nom de la branche. Testé par `backend/test/scripts/
   verifier-perimetre.spec.ts` sur un dépôt git jetable (cas : fichier propre
   OK, fichier partagé avant signal KO, ligne supprimée dans un partagé KO,
   spec existante modifiée KO).

Tant que S0 n'est pas mergé, la règle est la même mais **vérifiée à la main**
par chaque session : `git diff --name-only integration/cameleon` avant chaque
commit, tout doit être dans vos `propres`.

### 2.2 S1 — `typeEtablissement`

**Source de vérité : `Settings.typeEtablissement`** (par tenant), pas la
`Boutique` du registre. Raison : les boutiques en mode single (les clients
existants) n'ont **pas** de document `Boutique` ; `Settings`, elles l'ont
toutes. `Boutique.typeEtablissement` reçoit une **copie** à la création (pour
la liste du back-office) ; en cas d'écart, `Settings` gagne.

```ts
// backend/src/settings/settings.schema.ts
export const TYPES_ETABLISSEMENT = ['commerce', 'snack', 'restaurant', 'hotel'] as const;
export type TypeEtablissement = typeof TYPES_ETABLISSEMENT[number];
@Prop({ default: 'commerce', enum: TYPES_ETABLISSEMENT }) typeEtablissement: TypeEtablissement;
```

- Défaut `'commerce'` : **les trois clients existants ne changent pas**, et un
  document `Settings` sans le champ vaut commerce (le frontend lit
  `settings.typeEtablissement ?? 'commerce'`).
- Miroir frontend `api/settings.ts` : `TYPES_ETABLISSEMENT` avec libellé
  (`{ id, label }`), `typeEtablissement(settings)`. **Nouveau test de
  gouvernance** `api/types-etablissement-governance.spec.ts` sur l'idiome 1.8.
- `DemandeBoutique.typeEtablissement?` dans `provisionnement.service.ts` ;
  `creerBoutique` écrit le type dans `Settings` **et** sur `Boutique`, et pose
  les modules préréglés (S2). `listerBoutiques` renvoie `typeEtablissement`.
- `AdminBoutiques.tsx` : choix du type dans le formulaire « Nouvelle
  boutique », colonne « Type » dans la liste. `AdminParametres.tsx` : le type
  s'affiche (lecture seule pour le patron — changer de métier est une décision
  du revendeur, `PATCH /settings` refuse `typeEtablissement`).
- **Le type est modifiable par le superadmin, et journalisé.**
  `PATCH /platform/boutiques/:id/type` avec `{ type, appliquerPrereglage?:
  boolean }` : écrit `Settings.typeEtablissement` sous `runWithTenant` et la
  copie sur `Boutique` ; si `appliquerPrereglage` est vrai, remplace
  `Settings.modules` et `metier` par le préréglage du nouveau type (S2), sinon
  ne touche qu'au type — les choix de modules du patron survivent. Une ligne
  d'audit `module: 'plateforme'` porte l'avant et l'après (« Type de « X » :
  commerce → snack, préréglage appliqué ») avec l'auteur. Réservé au
  `superadmin` ; test qui prouve le 403 du patron et le témoin 200. Dans
  `AdminBoutiques.tsx`, un sélecteur « Type » par ligne, avec confirmation
  quand le préréglage va remplacer des modules.
- `GET /settings/public` (mode single) et `GET /settings` exposent le type.

### 2.3 S2 — préréglage de modules et de règles métier par type

Une table unique, backend, **importée** par le frontend via un miroir gouverné :

```ts
// backend/src/settings/profils.ts
export const PROFILS: Record<TypeEtablissement, {
  modules: ModuleId[] | 'tous';     // ce que le type active à la création
  metier: Partial<Settings['metier']>;
  accueilCaissier: string;          // route du poste de vente pour le rôle caissier
}> = {
  commerce:   { modules: 'tous', metier: {},                          accueilCaissier: '/caisse-pin' },
  snack:      { modules: ['comptoir'],           metier: { suiviPeremption: true  }, accueilCaissier: '/comptoir' },
  restaurant: { modules: ['comptoir', 'salle'],  metier: { suiviPeremption: true  }, accueilCaissier: '/salle' },
  hotel:      { modules: ['reception'],          metier: { suiviPeremption: false }, accueilCaissier: '/reception' },
};
```

- `MODULES_DISPONIBLES` gagne **dès le socle** les identifiants des trois
  profils : `'comptoir'`, `'salle'`, `'reception'` (des deux côtés, avec
  libellés). Les verticaux n'auront donc **pas** à toucher ce miroir : c'est le
  fichier le plus disputé, il est réglé une fois. Un module déclaré sans écran
  derrière n'affiche rien (aucune route, aucun item ne le référence encore).
- `HomeRedirect` (`App.tsx`) : pour le rôle `caissier`, lire
  `PROFILS[type].accueilCaissier` ; les autres rôles inchangés. Commerce garde
  `/caisse-pin`.
- Sidebars : les items des modules commerce (`caisses`, `étiquettes`,
  `entrepôt`…) restent visibles pour tous ; c'est la **désactivation par
  `modules`** qui masque, pas le type. Le type ne sert qu'au vocabulaire, à
  l'accueil et aux préréglages. Cela évite un `if (type === …)` dans chaque
  menu.
- **`Product.stockSuivi: boolean` (défaut `true`)** — le seul changement du
  socle dans le noyau de vente. Dans `SalesService.create()`, une ligne dont le
  produit a `stockSuivi === false` est traitée **comme une ligne `divers`
  pour le stock** (ni vérification, ni décrément, ni mouvement) tout en
  gardant `product`, donc `costPrice`, donc la marge. Un plat, une nuitée, une
  boisson au verre en ont besoin. Défaut `true` : aucun produit existant ne
  change de comportement ; test nominal ajouté, tests existants intacts.

### 2.4 S3 — vocabulaire par profil

```ts
// frontend/src/i18n/vocabulaire.ts
export type Terme = 'article' | 'articles' | 'stock' | 'vente' | 'caisse' | 'client' | 'ticket';
export function v(terme: Terme, type = typeEtablissement(settings)): string
// commerce : article / stock / vente / caisse / client / ticket
// snack     : article / réserve / vente / comptoir / client / ticket
// restaurant: plat    / réserve / addition / salle / table / addition
// hotel     : prestation / — / séjour / réception / client / facture
```

Chaque valeur passe par `t()`. Les écrans **communs** (rapports, exports,
audit) emploient `v()` là où le mot change ; les écrans commerce existants ne
sont **pas** réécrits pour ça — seuls les libellés d'en-tête qui apparaissent
aussi aux autres profils (rapport journalier, consolidé) sont touchés. Test :
chaque type a une valeur pour chaque terme, FR et EN non vides.

### 2.5 S4 — sélecteur et consolidé à types mélangés

- `GET /consolide/boutiques` renvoie `typeEtablissement` avec le nom ;
  `SelecteurBoutique` affiche un pictogramme par type (boutique, verre,
  couvert, lit).
- `GET /consolide/rapport` : chaque ligne porte `type` ; le total gagne
  `parType: { commerce: {ca, ventes}, … }` ; `RapportConsolide.tsx` regroupe
  par type quand il y en a plus d'un. La source reste `Sale` : rien ne change
  pour un propriétaire mono-type. Test e2e : deux boutiques de types différents
  sous le même propriétaire, sous-totaux exacts, témoin.

### 2.6 S5 — kit d'ouverture et documentation

- `scripts/init-boutique.ts` accepte `--type=` (défaut `commerce`) et applique
  `PROFILS`. `migrate-settings-identite.ts` : les préréglages existants
  reçoivent `typeEtablissement: 'commerce'` explicitement.
- Ce document est mis à jour avec les identifiants réels ; `DEPLOY.md` gagne
  « ouvrir une boutique d'un autre type ».

### 2.7 Estimation du socle

| Bloc | Effort |
|---|---|
| S0 CI frontend + périmètres (JSON, script, job CI, test) | 0,5 j |
| S1 typeEtablissement (schéma, miroir, gouvernance, provisionnement, back-office, paramètres) | 1 j |
| S2 profils, modules, `stockSuivi`, accueil caissier | 1 j |
| S3 vocabulaire | 0,5 j |
| S4 consolidé et sélecteur | 0,5 j |
| S5 scripts et docs | 0,5 j |
| **Total** | **4 jours**, en deux ou trois commits sur `integration/cameleon`, CI verte, suite existante inchangée |

Critère de fin : `git diff --stat` du socle ne touche **aucun fichier
`*.spec.ts` existant** ; 295 + 120 tests passent ; les nouveaux tests couvrent
type, profils, `stockSuivi`, vocabulaire, consolidé mixte.

---

## 3. Discipline de travail — chaque session verticale

1. **Lire d'abord** : `CLAUDE.md` (règles 1 à 5, en entier), puis ce document,
   puis le brief de votre profil (section 4). Ne pas ouvrir un fichier de code
   avant. Vous travaillez sur un logiciel qui encaisse de vraies ventes dans
   trois boutiques : la règle 3 (rien en production sans go explicite et cycle
   complet) vous concerne même si vous n'y touchez « jamais ».
2. **Branche et worktree** : `feat/cameleon-<profil>`, créée par la
   référente depuis `integration/cameleon` dans son propre worktree
   (`../cameleon-<profil>`). Vous travaillez **uniquement** dans ce dossier ;
   le dépôt principal (`familystore-pos/`) est celui de la référente, n'y
   touchez pas. Rebaser sur `origin/integration/cameleon` avant chaque PR et à
   chaque signal de la référente. Jamais depuis `main`, jamais vers `main`.
   Premier démarrage d'un worktree : `npm install` dans `backend/` **et**
   `frontend/` (les `node_modules` ne sont pas partagés), copier
   `backend/.env` depuis le dépôt principal (base de test, jamais la
   production), et poser `MONGOMS_DOWNLOAD_DIR` sur le cache du dépôt
   principal (`familystore-pos/backend/node_modules/.cache/mongodb-memory-server`)
   pour ne pas retélécharger le binaire `mongod` (≈ 600 Mo, voir CLAUDE.md).
   Les serveurs de développement partagent les ports 3004 et 5180 : une seule
   pile `npm run dev` à la fois sur la machine, ou `PORT=` / `--port` distincts.
   Les tests, eux, ne s'entravent pas (base en mémoire par processus).
3. **Périmètre mécanique** (S0) : tant que `socleMerge` est `false` dans
   `cameleon-perimetres.json`, vous ne modifiez que vos fichiers `propres`.
   Au signal (le socle mergé, le drapeau à `true`), vous rebasez et pouvez
   ajouter — jamais retirer — dans les `partages`. `npm run verifier:perimetre
   -- --profil=<profil>` avant chaque commit ; la CI le rejoue.
4. **Jamais sur `main`, jamais d'écriture en production.** La `.env` locale
   vise `familystore_test` sur l'ancien cluster ; les scripts de
   `backend/scripts/` visent la production, les lire avant de les lancer, ne
   jamais passer `--execute`. Aucun `git commit` / `git push` sans que Valdes
   l'ait demandé pour cette action-là (règle 1).
5. **Tests et gouvernance dans le même commit que la fonctionnalité** (règle
   5) : contrôle d'accès si la route en a un (`@Roles` + test qui prouve le
   403 **et** un témoin 200), gouvernance si vous créez un miroir front/back ou
   un motif de stock, cas nominal sinon. Une fonctionnalité sans son test est
   un WIP, pas une livraison.
6. **Le noyau ne bouge pas.** Interdits sans accord de Valdes : `Caisse.tsx`
   (2 068 lignes, c'est le poste de vente de trois boutiques — créez **votre**
   écran), `sales.service.ts` hors `stockSuivi`, `sale.schema.ts`,
   `tenancy/*`, `platform/*`, `storage.ts`, les tests existants. Réutilisez
   par **import** (`offlineSync.savePendingSale`, `ReceiptPrint`,
   `api/products`, `utils/sku`, `utils/text`), pas par copie ni par refactor.
7. **Fichiers partagés à toucher avec parcimonie** : `App.tsx` (vos routes,
   sous `RequireModule` et `RequireRole`), `AdminSidebar.tsx` /
   `StocksSidebar.tsx` (vos items avec `module:`), `backend-messages.ts` (vos
   messages), `stock-movement.schema.ts` + `Stocks.tsx › REASON_LABELS` (vos
   motifs, **les deux**). Ce sont les zones de conflit entre sessions : petites
   modifications additives, en fin de fichier ou de liste.
8. **PR vers `integration/cameleon`**, CI verte, relecture de Valdes. La PR
   dit : ce que le profil fait, ce qu'elle touche dans les fichiers partagés,
   les tests ajoutés, et **la preuve que la suite existante n'a pas changé**
   (`git diff integration/cameleon -- '**/*.spec.ts'` vide sur les fichiers
   préexistants).
9. **Rapport d'étape par bloc**, pas un rapport unique à la fin : à chaque
   bloc du brief terminé (schéma + service + écran + tests), un message court
   à Valdes : fait, vérifié comment (chiffres), ce qui suit, ce qui bloque. Il
   relit et déploie en fenêtre ; il ne doit jamais découvrir trois semaines de
   travail d'un coup.
10. **Backend en français**, chaînes visibles via `t()`, noms via
   `displayName()`. Messages de commit en français avec préfixe conventionnel
   (`feat(salle):`, `test(reception):`).

---

## 4. Brief par profil

### 4.1 Snack-bar

**Ce qu'il vend et comment.** Boissons (bouteilles, canettes, verres),
grignotage, quelques plats simples. Vente **au comptoir**, sans code-barres :
le vendeur tape sur une **grille tactile** de produits classés (bières,
sodas, eaux, snacks), encaisse tout de suite, ticket ou pas. Réassort par
**casiers** (un casier = N bouteilles), **consignes** sur les bouteilles en
verre (le client paie une consigne, la récupère au retour du vide), stock de
la **réserve** à surveiller (casiers pleins, vides à rendre au livreur).

**Ce qui diffère de Commerce.** Pas de scan, pas d'étiquettes, pas
d'entrepôt/magasinier, pas de péremption stricte. Une unité de vente
(bouteille) et une unité d'achat (casier). Une consigne encaissée n'est pas un
chiffre d'affaires. Le poste de vente doit tenir sur une tablette, en plein
soleil, avec un vendeur debout.

**Ce qui existe déjà et se réutilise.** La caisse commerce est **déjà**
tactile par cartes de catégories (`viewMode: 'grid'` par défaut) : l'écran
`Comptoir` est une version **réduite** de ce mode — pas une réécriture.
`Product.unit = 'bouteille'` est connu et traduit (`utils/unites.ts`).
`offlineSync.savePendingSale` et `syncPendingSales` pour le hors-ligne,
`ReceiptPrint` pour le ticket, `sessions` pour l'ouverture/fermeture,
`StockMovement` avec motifs pour la réserve.

**Modules.** Activer : `comptoir`. Désactiver (via `modules` du profil) :
`partenaires`, `factures-fournisseurs` (activable plus tard). Les écrans
commerce restent accessibles mais l'accueil caissier est `/comptoir`.

**Écrans nouveaux.**
- `pages/Comptoir.tsx` : grille de produits par catégorie (grosses cases,
  prix visible), panier à droite, encaissement en deux taps (espèces / Mobile
  Money), bouton « consigne » sur les produits qui en portent, bouton
  « retour de vide » qui rembourse la consigne. Ticket optionnel.
- Onglet « Réserve » dans l'espace stock existant (`StocksSidebar`, item
  `module: 'comptoir'`) : entrée par casier, conversion automatique en
  bouteilles, vides à rendre.

**Modèle de données.**
- `Product` : `conditionnement { unite: 'casier', contenance: 24 }`
  optionnel, `consigne: number` (0 = pas de consigne). Une réception « 3
  casiers » écrit `+72` sur `stock` avec un motif `reception_casier`.
- `Sale` : la consigne est une **ligne à part** (`divers: true`,
  `name: 'Consigne <produit>'`, `unitPrice: consigne`) pour que le total
  encaissé soit juste **et** que la comptabilité puisse l'isoler par son nom ;
  le retour de vide est une ligne à **prix négatif** ? **Non** — `unitPrice
  min 0` sur `Sale`. Le retour de vide est une **dépense** (`Expense`,
  catégorie `Consigne rendue`) ou, mieux, un document `MouvementConsigne`
  propre au module (encaissée / rendue, par produit, par jour) qui produit un
  `Sale` à l'encaissement et une `Expense` à la restitution. Trancher avec
  Valdes au premier rapport d'étape ; recommandation : `MouvementConsigne` +
  `Expense`, la caisse du soir reste juste.
- Nouveaux motifs de stock : `reception_casier`, `casse`. **Les deux côtés**
  (`MOVEMENT_REASONS` + `REASON_LABELS`), sinon la gouvernance casse.

**Pièges connus du dépôt qui vous concernent.**
- `Sale.unitPrice` a `min: 0` : pas de ligne négative, d'où le traitement de
  la restitution de consigne ci-dessus.
- `PAYMENT_METHODS` de la caisse n'a que 3 entrées (`cash`, `mobile_money`,
  `card`) alors que l'enum backend en a 6 : reprenez les trois, n'inventez pas.
- La quantité vendue d'un produit à `stockSuivi: true` est **vérifiée** en
  stock : un snack qui vend au verre une bouteille comptée en bouteilles
  mettra ce produit en `stockSuivi: false` ou créera un produit « verre » à
  part. Documentez le choix dans l'écran.
- Motif de stock : deux fichiers, deux langues, listes identiques.
- Les libellés d'unité s'affichent via `uniteAffichee()` ; ne pas réécrire
  `unit` en base.

**Estimation.** 6 à 8 jours : comptoir 3 j, réserve/casiers 1,5 j, consignes
1,5 j, tests et gouvernance 1 j, rapport d'étape à chaque bloc.

### 4.2 Restaurant

**Ce qu'il vend et comment.** Des plats et boissons servis **à table**. Le
serveur ouvre une **addition** sur une table, y ajoute des lignes au fil du
repas, **envoie** les plats en **cuisine** (qui les prépare et les marque
prêts), puis **encaisse** en une fois — ou **partage** l'addition entre
convives. Les plats consomment un **stock d'ingrédients** selon une
**recette** ; c'est l'ingrédient qu'on réapprovisionne, pas le plat.

**Ce qui diffère de Commerce — et ce qui touche au modèle « une vente = un
ticket fermé ».** Il y a un état **ouvert** qui dure une heure et change de
mains (serveur, cuisine, caisse). Ce n'est **pas** un `Sale` : `Sale` n'a pas
de statut et ne doit pas en avoir. C'est une **`Addition`** (collection du
module) : `table`, `serveur`, `ouverteLe`, `lignes[{produit, nom, quantite,
prixUnitaire, envoyeeLe?, preteLe?, servieLe?}]`, `statut ∈ {ouverte,
partiellement_reglee, reglee, annulee}`, `reglements[{saleId, montant,
convives?}]`. **La fermeture crée un ou plusieurs `Sale`** par
`SalesService.create()` avec `idempotencyKey = 'addition:<id>:<n>'`, lignes
= plats servis (produits `stockSuivi: false`), `paymentMethod` de chaque
règlement. Un partage = plusieurs `Sale` sur la même addition. Le ticket
imprimé est celui du `Sale` (`ReceiptPrint`), l'addition à présenter avant
paiement est un **document du module** (pas une facture archivée).

**Recettes et stock.** `Recette { produitVendu, ingredients[{produit,
quantite}] }`. À la **fermeture** de l'addition (pas à l'envoi en cuisine —
un plat annulé avant service ne doit pas consommer), le module appelle son
propre `ConsommationService.consommer(sale)` : pour chaque ligne avec recette,
`$inc stock` des ingrédients + `StockMovement {OUT, consommation_recette}`,
idempotent par clé `recette:<saleId>`. `SalesService.create()` n'est **pas**
modifié : les plats sont `stockSuivi: false`, il ne les touche pas. Le
gaspillage ou la casse d'un ingrédient : motif `perte`. Les ingrédients sont
des `Product` ordinaires (`stockSuivi: true`), gérés dans l'espace stock
existant — la cuisine réapprovisionne comme une boutique.

**Modules.** Activer : `salle` (+ `comptoir` pour le bar, réutilisé du
profil snack : **le profil restaurant démarre après le merge de snack**).
`factures-fournisseurs` utile (factures des grossistes), activable.

**Écrans nouveaux.**
- `pages/Salle.tsx` : plan de tables (grille configurable dans Paramètres :
  numéros, capacités, zones), état par table (libre, occupée, addition à
  régler), ouverture d'addition, ajout de lignes depuis la carte (grille
  tactile héritée du comptoir), envoi cuisine, partage et encaissement.
- `pages/Cuisine.tsx` : file des lignes envoyées, par table et par heure,
  « prêt » en un tap. Rôle : réutiliser `magazinier` ? **Non** — créer le rôle
  `cuisine` dans l'enum `User.role` (additif) avec `@Roles('cuisine',
  'patron')` sur les routes de préparation, et sa redirection dans
  `HomeRedirect`. Test d'accès obligatoire.
- Onglet « Recettes » dans l'espace stock (`module: 'salle'`) : composer un
  plat, coût de revient calculé, marge affichée.
- « Additions ouvertes » dans l'espace admin : ce qui n'est pas encore
  encaissé, par serveur ; c'est le contrôle du patron.

**Hors-ligne.** Une addition ouverte doit survivre à une coupure réseau :
file `pending_additions` ajoutée à `CLES_FILES`, écrite via `storage.ts`,
avec `boutiqueId` et clé d'idempotence par addition. La cuisine, elle,
suppose le réseau local. Dire clairement dans l'écran ce qui marche sans
réseau (prendre la commande, encaisser) et ce qui attend (cuisine).

**Pièges connus du dépôt qui vous concernent.**
- `Sale.unitPrice min 0` et `quantity min 1` : un « geste commercial » se
  fait par `discount` (0–100 %) sur la ligne ou `offrePct` sur le ticket,
  jamais par ligne négative.
- `SalesService.create()` vérifie le stock des lignes `product` à
  `stockSuivi: true` : un plat oublié en `true` sera **refusé** en caisse pour
  stock insuffisant. Le formulaire de recette doit poser `stockSuivi: false`
  sur le plat, et le test le prouver.
- La fenêtre de correction d'un `Sale` est de 30 jours et la suppression est
  physique : une addition **annulée avant règlement** n'a rien à corriger ;
  après règlement, c'est la correction de vente commerce qui s'applique
  (`@Roles('patron')`).
- `sessionId` sur `Sale` est une chaîne : reprenez `getActiveSession()`
  comme la caisse pour que la session du soir compte les tables.
- Le consolidé et la comptabilité ne voient que `Sale.total` : un partage en
  trois `Sale` compte trois « ventes ». Acceptable ; le dire dans le rapport
  d'étape, pour que Valdes le sache avant que le client le remarque.
- Le module `partenaires` a un `Paiement-partenaire` : rien à voir avec vos
  règlements d'addition, ne pas le réutiliser.

**Estimation.** 15 à 20 jours : addition et plan de salle 5 j, cuisine et
rôle 3 j, recettes et consommation 3 j, partage et encaissement 2 j,
hors-ligne 2 j, tests et gouvernance 2 j, marges 2 j.

### 4.3 Hôtel / meublé

**Ce qu'il vend et comment.** Des **nuitées** dans des **chambres**, sur
**réservation** (téléphone, WhatsApp, passage), avec **acompte** à la
réservation et **solde** au départ, parfois des extras (petit-déjeuner,
lessive, boissons du frigo). Le cycle : réservation → arrivée (check-in,
pièce d'identité) → séjour (extras, prolongation) → départ (check-out,
facture, solde) → **ménage** → chambre disponible. Le patron veut voir le
**calendrier d'occupation**, les arrivées et départs du jour, ce qui reste à
encaisser, et ce que le ménage a fini.

**Ce qui diffère de Commerce.** Presque tout ce qui est visible. Le
« produit » est une chambre **dans le temps** ; le stock est un **calendrier**,
pas un compteur ; la vente s'étale sur des jours ; le client est **identifié**
(nom, téléphone, pièce). Pas de code-barres, pas de réserve au sens stock,
pas de caisse au sens comptoir — mais bien une **réception** qui encaisse.

**Ce qui est réutilisable tel quel.** La tenancy, le propriétaire et le
sélecteur (un propriétaire de deux hôtels et une boutique), la licence, le
back-office superadmin, les `Settings` (identité, logo, langue, mentions du
ticket), l'authentification et les rôles (`patron`, `caissier` = réceptionniste
au vocabulaire près), les `Sessions` de travail, l'audit, `Expense` pour les
dépenses, `ReceiptPrint` et l'archive de factures (`Facture` avec PDF) pour
la facture de séjour, `reports.service.ts › brand()` pour les PDF, le
consolidé (par `Sale`), la file hors-ligne pour les encaissements. Le module
`factures-fournisseurs` peut servir (blanchisserie, fournisseurs).

**Entièrement à créer.**
- `Chambre { numero, type (ref TypeChambre), etage, statut ∈ {libre,
  occupee, a_nettoyer, en_nettoyage, hors_service}, notes }`.
- `TypeChambre { nom, capacite, prixNuit, prixNuitWeekend?, equipements[] }`
  — chaque type est **aussi** un `Product` à `stockSuivi: false`
  (« Nuitée Standard ») pour que les nuitées sortent dans les rapports de
  ventes par produit sans code spécial.
- `Client { nom, telephone, email?, pieceIdentite { type, numero }, notes }`.
- `Reservation { client, chambre?, typeChambre, arrivee, depart, nbPersonnes,
  statut ∈ {en_attente, confirmee, arrivee, terminee, annulee, no_show},
  source, acompteAttendu }`.
- `Sejour { reservation, chambre, arriveeReelle, departReel, extras[{produit,
  nom, quantite, prixUnitaire, le}], reglements[{saleId, montant, le, objet
  ∈ {acompte, solde, extra}}], solde calculé }`.
- `TacheMenage { chambre, creeLe, faitLe?, par?, remarque }`, créée
  automatiquement au check-out.
- **Calendrier** : `GET /hotel/occupation?du&au` → par chambre, par jour,
  l'état ; la disponibilité d'un type sur une période est **calculée**
  (chambres du type moins réservations qui chevauchent), jamais stockée.
  C'est l'invariant du profil : **pas de double réservation** — index et
  vérification serveur au moment de confirmer, test qui tente la collision.

**Le lien avec la vente.** Chaque encaissement (acompte, solde, extra payé sur
place) = un `Sale` via `SalesService.create()`, `idempotencyKey =
'sejour:<id>:<objet>:<n>'`, lignes : « Acompte séjour ch. 12 », « 3 nuitées
Standard » (produit type de chambre), extras (produits du frigo à
`stockSuivi: true` si l'hôtel veut suivre son frigo). La **facture de séjour**
est un document du module (récapitulatif nuitées + extras + règlements), rendu
en PDF via `brand()` et archivé dans `Facture` comme un ticket.

**Modules.** Activer : `reception`. Désactiver : tout le stock boutique sauf
si le patron tient un frigo/bar (alors `comptoir` en plus, hérité du snack).
`suiviPeremption: false`.

**Écrans nouveaux.**
- `pages/Reception.tsx` : aujourd'hui (arrivées, départs, en séjour, chambres
  à nettoyer), recherche client, nouvelle réservation en 4 champs, check-in,
  check-out avec solde.
- `pages/Calendrier.tsx` : grille chambres × jours, glisser pour réserver,
  couleurs par statut.
- `pages/Menage.tsx` : liste des chambres à faire, « fait » en un tap. Rôle
  `menage` (additif dans l'enum) ou réutilisation de `magazinier` au
  vocabulaire près ? Recommandation : nouveau rôle `menage`, `@Roles`, test
  d'accès ; le vocabulaire ne suffit pas à cacher des écrans de stock à une
  femme de chambre.
- Paramètres : chambres et types (`module: 'reception'` dans `AdminSidebar`).

**Pièges connus du dépôt qui vous concernent.**
- **Dates et fuseaux** : le backend tourne en `TZ=Africa/Douala` sur Render ;
  `joursAvantEcheance` dans `licence.schema.ts` documente pourquoi on compte
  **de début de journée à début de journée** et jamais par division d'un
  écart d'instants. Les nuitées se comptent pareil. Écrire ce calcul dans un
  utilitaire pur testé avant tout écran.
- La licence expirée bloque toute écriture non exemptée (402) : un check-out
  avec solde en licence expirée sera refusé. C'est voulu ; le dire dans
  l'écran plutôt que de contourner.
- `Sale.paymentMethod` accepte `credit` : un solde dû au départ **n'est pas**
  un `Sale` à `credit`, c'est un `Sejour` à solde non nul. Ne créer le `Sale`
  qu'à l'encaissement réel.
- Pas de client identifié sur `Sale` : le lien vente ↔ client passe par
  `Sejour.reglements[].saleId`, pas par un champ ajouté à `Sale`.
- La correction de vente (30 j, `@Roles('patron')`) s'applique aux
  encaissements ; l'annulation d'une réservation **avant** acompte n'a rien à
  corriger ; le remboursement d'un acompte n'existe pas dans le noyau
  (section 1.10) — c'est une `Expense` catégorie « Remboursement acompte »,
  tracée sur le `Sejour`. À trancher avec Valdes au premier rapport d'étape.
- L'isolation e2e (`isolation-routes`) balaiera vos routes GET : réservations
  et clients d'un hôtel ne doivent jamais fuiter vers l'autre tenant, y
  compris par `_id` direct.

**Estimation.** 25 à 35 jours : modèle et calendrier 6 j, réception
(réservation, check-in/out, solde) 7 j, encaissements et facture de séjour 4 j,
ménage et rôle 3 j, paramètres chambres 2 j, hors-ligne minimal 2 j, tests et
gouvernance 3 j, marges 3 j. C'est un produit neuf posé sur un socle éprouvé,
pas une variante.

---

## 5. Ordre, priorité, parallélisme

**Ordre des merges : socle → Snack-bar → Restaurant → Hôtel.** Pour ces raisons :

1. **Le socle d'abord, seul.** Il touche les fichiers que tous les verticaux
   auraient dû toucher : `MODULES_DISPONIBLES` des deux côtés, `Settings`,
   `provisionnement.service.ts`, `App.tsx`, les sidebars, le consolidé, le
   sélecteur. Trois sessions qui les modifient en même temps produisent trois
   rebases conflictuels et une CI qui casse à tour de rôle. Une seule session
   les modifie une fois ; les autres n'y ajoutent ensuite que des lignes en fin
   de liste.
2. **Snack ensuite, parce qu'il est le plus petit et qu'il valide le motif.**
   Nouveau module, nouvel écran de vente, nouveaux motifs de stock, un test
   d'accès, une gouvernance : tout ce qu'un profil doit faire, en 6 à 8 jours.
   S'il révèle qu'une pièce du socle manque (un terme de vocabulaire, une
   option de profil), on la corrige avant que deux autres sessions ne
   contournent chacune à sa façon. Et le **comptoir tactile** qu'il produit est
   **réutilisé** par le bar du restaurant et le frigo de l'hôtel.
3. **Restaurant après Snack**, parce qu'il en dépend (comptoir) et parce qu'il
   introduit la seule idée nouvelle sur la vente — l'addition ouverte qui se
   ferme en `Sale`. Cette idée doit être relue par Valdes sur un cas concret
   avant que l'hôtel ne fasse la même chose avec les séjours.
4. **Hôtel en dernier**, parce qu'il est le plus gros, le plus neuf, et qu'il
   réutilise les deux décisions précédentes (objet ouvert → `Sale`, rôle
   additif avec test d'accès). Le démarrer plus tôt reviendrait à trancher ces
   décisions deux fois.

**Décision de Valdes (11/09/2026) : quatre sessions en parallèle, une par
profil, chacune dans son worktree** — la référente sur `familystore-pos/`
(`integration/cameleon`), et `../cameleon-snack`, `../cameleon-restaurant`,
`../cameleon-hotel` sur leurs branches `feat/cameleon-<profil>`. L'ordre
ci-dessus reste celui des **merges**, pas celui des démarrages : les trois
verticaux démarrent tout de suite, sur leurs fichiers propres.

Ce qui rend le parallèle sûr, c'est le **périmètre mécanique** (S0, section
2.1), pas la bonne volonté. Trois zones de contact sont inévitables entre
profils : `App.tsx` (routes), les sidebars (items), et le couple
`MOVEMENT_REASONS` / `REASON_LABELS` (motifs, gouvernés). La règle les
neutralise en deux phases :

- **Phase 1 — avant le signal** (`socleMerge: false`) : chaque session ne
  touche que ses `propres` — son module Nest, ses tests, ses pages, son
  `api/<profil>.ts`. Aucun fichier partagé, donc aucun conflit possible entre
  branches, et Commerce ne peut pas bouger. Cette phase couvre le modèle de
  données, les services, les écrans rendus **sans route** (testables en
  isolation), les tests.
- **Phase 2 — après le signal** (la référente merge le socle et passe le
  drapeau à `true`) : rebase, puis ajouts **additifs** dans les `partages` —
  une route, un item de menu, un motif, un message traduit. Quelques lignes en
  fin de liste par branche : le rebase se fait en cinq minutes, et
  `verifier-perimetre` refuse toute ligne supprimée dans un partagé.

Le calendrier qui en découle :

| Période | Référente | Snack | Restaurant | Hôtel |
|---|---|---|---|---|
| Jours 1–2 | Fin de Commerce (paiement manuel, demandes de boutique), **S0** | Phase 1 : produits, casiers, consignes, écran comptoir sans route | Phase 1 : `Addition`, recettes, consommation, écrans sans route | Phase 1 : chambres, réservations, calendrier, séjours |
| Jours 3–6 | **S1 à S5**, merge, **signal** | Phase 1 suite, tests | Phase 1 suite, tests | Phase 1 suite, tests |
| Ensuite | Relecture des PR, socle ajusté si un vertical le demande | Phase 2 → **PR n° 1** | Phase 2 après le merge de Snack (reprend la grille du comptoir) → **PR n° 2** | Phase 2 → **PR n° 3** (le plus long) |

Le Restaurant réutilise la grille tactile du comptoir : tant que Snack n'est
pas mergé, il construit son écran de salle **sans** elle (liste simple de la
carte) et la branche au merge. Le Hôtel ne dépend de personne, mais son
encaissement (séjour → `Sale`) reprend la décision prise pour l'addition ;
si la relecture de Valdes la modifie sur Restaurant, Hôtel s'aligne avant sa PR.

**Relecture et fenêtres.** Valdes relit chaque PR et merge lui-même. Une PR
par profil, au terme de la phase 2 — pas de PR partielles, les rapports
d'étape suffisent en cours de route. Aucune de ces branches ne va sur `main`
avant le lot E.

**Une session ne fusionne pas la branche d'une autre.** Chaque PR est relue
et mergée par Valdes ; la session suivante rebase après le merge, pas avant.

---

## Annexe — pointeurs rapides

| Besoin | Fichier |
|---|---|
| Contexte tenant, mode | `backend/src/tenancy/tenant-context.ts` |
| Créer une boutique (registre + tenant) | `backend/src/platform/provisionnement.service.ts` |
| Lecture seule licence expirée | `backend/src/platform/licence.interceptor.ts` |
| Créer une vente | `backend/src/sales/sales.service.ts › create()` |
| Motifs de stock (miroir) | `backend/src/schemas/stock-movement.schema.ts` · `frontend/src/pages/Stocks.tsx › REASON_LABELS` |
| Modules optionnels (miroir) | `backend/src/settings/settings.schema.ts` · `frontend/src/api/settings.ts` |
| Rôles | `backend/src/schemas/user.schema.ts` · `auth/roles.guard.ts` · `App.tsx › RequireRole, HomeRedirect` |
| Stockage local, files hors-ligne | `frontend/src/services/storage.ts` · `offlineSync.ts` · `session.ts › CLES_FILES` |
| Ticket, facture archivée | `frontend/src/components/ReceiptPrint.tsx` · `backend/src/factures/` |
| PDF avec identité | `backend/src/reports/reports.service.ts › brand()` |
| Traductions des erreurs backend | `frontend/src/i18n/backend-messages.ts` |
| Ouvrir une boutique neuve (script) | `backend/scripts/init-boutique.ts` |
| Premier superadmin | `backend/scripts/creer-superadmin.ts` |
| Bascule et pré-vol production | `LOT-E.md` · `npm run verifier:lot-e` |
