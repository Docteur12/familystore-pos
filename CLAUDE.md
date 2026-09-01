# CLAUDE.md — Family Store POS

## ⛔ Règles impératives

### 1. Ne jamais commiter ni pousser sans instruction explicite

Aucun `git commit`, `git push`, `git merge`, création de branche ou de PR sans
que je l'aie demandé, explicitement, pour cette action-là. Modifier les fichiers
du working tree : oui. Les figer dans l'historique ou les envoyer sur GitHub :
seulement sur demande.

Une autorisation donnée pour un commit ne vaut pas pour le suivant.

### 2. Fenêtres de déploiement

Déploiements uniquement **avant 9 h** ou **après la fermeture des boutiques**.

Les caisses sont utilisées en continu pendant les heures d'ouverture : une mise
en production dans cette plage interrompt des ventes en cours. Cela vaut pour
tout ce qui touche la production — backend, frontend, migrations de base.

**Tout ce qui arrive sur `main` est déployé automatiquement** : Netlify
(frontend) et Render (backend, service `familystore-pos`) reconstruisent à
chaque push — y compris un merge de PR depuis GitHub. Merger une PR sur `main`
**est** un déploiement et obéit à la même fenêtre horaire.

Si le changement exige une migration de données, l'ordre est impératif :
**sauvegarde → migration sur la base `familystore` → merge/push**. Le
17/08/2026, la PR tenancy a été mergée à 8 h 49 sans que
`scripts/migrate-add-tenant.ts --execute` ait tourné sur la prod : le plugin
filtrait sur un champ `tenant` absent, plus personne n'a pu se connecter
jusqu'à 15 h 30. La `.env` locale vise `familystore_test` ; les scripts qui
doivent toucher la prod doivent explicitement viser `familystore`.

### 3. Rien ne touche la production sans « go » explicite ET cycle complet

**Aucune écriture sur une base de production, aucun déploiement, aucun
`--execute`** sans mon accord explicite dans la conversation — accord donné
pour *cette* opération-là, jamais pour la suivante.

Cet accord ne se demande qu'une fois le cycle complet effectué :

1. **Répétition sur copie** — l'opération entière rejouée sur une copie fraîche
   de la base concernée, pas sur `familystore_test` « parce que la `.env` y
   pointe ».
2. **Vérification chiffrée** — des comptes, pas une impression d'écran :
   « N/N documents, écart 0 », comme le fait `migrate-add-tenant`.
3. **Rollback TESTÉ** — exécuté sur la copie et vérifié. Un script de rollback
   qui existe sans avoir jamais tourné ne compte pas.
4. **Sauvegarde fraîche prise juste avant** l'opération réelle. Une sauvegarde
   de l'avant-veille ne protège pas : la restaurer coûterait les ventes du jour.
   `node scripts/copy-db.js <source> <destination>` — l'outil signale
   désormais tout index non recréé et **sort en erreur** : une copie qui a
   perdu ses garanties d'unicité n'est pas une sauvegarde (il perdait
   silencieusement les 4 index partiels, dont ceux des clés d'idempotence).

Rollbacks disponibles, tous **qualifiés sur copie le 21/08/2026** :
`migrate:tenant:rollback` (aller-retour 4 916 → 0 → 4 916, écart 0),
`migrate:settings:rollback -- --depuis=<sauvegarde>` et
`migrate:pin:rollback -- --depuis=<sauvegarde>`. Les deux derniers restaurent
**depuis une sauvegarde** : un simple `$unset` détruirait des valeurs
préexistantes ou remplacées (c'est le test sur copie qui l'a montré).

**Toute opération irréversible est annoncée comme telle AVANT**, avec ce qu'on
perd et ce que devient le retour arrière. Exemple vécu (21/08/2026) : la purge
des PIN en clair a rendu le revert de code impossible sans redéfinir les PIN à
la main — ça aurait dû être dit avant, pas constaté après.

Ne jamais annoncer « le retour arrière est prêt » sans l'avoir vérifié.

**Le pré-vol `npm run verifier:lot-e` est systématique APRÈS toute migration
de production** — pas seulement avant une bascule. Il lit la base (rien
d'autre) et compte : PIN hachés, documents cloisonnés, index composites,
identité, e-mails. Une migration « faite » n'est faite que quand ce compte le
dit.

Origine : le 21/08/2026, `migrate:pin` a été appliquée sur une base `radiance`
du **mauvais cluster** (`4uxjx09` au lieu de `fjo84gc`), puis « refaite » sur
le bon — sauf qu'elle ne l'a pas été. Personne ne l'a vu : le code déployé
exigeait `pinKdf`, les quatre caisses Radiance n'en avaient pas, et la
découverte a attendu le pré-vol du lot E, **six jours plus tard**. Lancé le
jour même sur la base réelle, il aurait rendu `4/4 SANS pinKdf` en dix
secondes. Une vérification chiffrée qui n'est pas lancée n'a jamais existé.

### 4. Deux clients, une base de code

Ce dépôt sert **deux clients** :

| Client | Langue | Frontend |
|---|---|---|
| **Family Store** | FR | `frontend/` |
| **Radiance POS** | EN | dépôt `radiance-pos` (portage) |

L'unification en **SaaS multi-tenant** est en cours. Conséquence pratique :
avant de coder une règle métier, se demander si elle vaut pour les deux clients
ou seulement pour l'un — et si un libellé doit être traduit.

### 5. Une fonctionnalité sans son test est un WIP, pas une livraison

Toute fonctionnalité livrée inclut sa garantie **dans le même commit** : le
test qui prouve son contrôle d'accès si elle en a un, le test de gouvernance
si elle crée une table ou un miroir front/back, le test du cas nominal sinon.
Une fonctionnalité sans son test est un WIP, pas une livraison — quelle que
soit la session qui la produit.

Origine (27/08/2026) : deux chantiers repris d'une autre session étaient
corrects — la correction de vente, les libellés des motifs de stock — et
arrivaient l'un sans la preuve que seul le patron y accède, l'autre sans le
miroir front/back qui empêche un nouveau motif de réapparaître en code brut.
À chaque fois la fonctionnalité était bonne ; c'est la garantie qui manquait,
et la reconstruire a posteriori coûte une demi-journée là où l'écrire avec le
contexte coûte cinq minutes.

---

## État du chantier multi-tenant

Mergé sur `main`. Le cloisonnement repose sur un plugin Mongoose appliqué **une
seule fois** à la connexion (`app.module.ts`, via `connectionFactory`) : les
schémas métier héritent du filtrage par tenant sans modification module par
module. Le plugin est *fail-closed* — hors contexte tenant, il lève.

- `backend/src/tenancy/` — contexte CLS (`nestjs-cls`), interceptor HTTP, plugin
- `backend/test/tenancy/` — 6 suites dédiées, dont
  `isolation-routes.e2e.spec.ts` (lot 7) : démarre l'application réelle en
  mode `multi`, plante deux magasins et balaie **toutes** les routes GET (62
  relevées, 60 répondent 200) en exigeant qu'aucune donnée de B n'apparaisse,
  y compris par accès direct aux `_id` de B. La suite porte un garde-fou
  (au moins 50 routes doivent répondre 200) et un témoin de détection, sans
  quoi elle passerait « au vert » en ne prouvant rien.
- `backend/scripts/migrate-add-tenant.ts` et son rollback
- `npm run verifier:tenancy` — état chiffré d'une base (documents cloisonnés,
  index composites). C'est l'outil de la « vérification chiffrée » exigée par
  la règle n° 3.

### Mode `multi` — état réel

Le jeton porte désormais `tenantId` (posé par `emettreJeton`, lu par
`TenantInterceptor`) : c'est le point « `tenantId` dans le JWT + guards » de la
phase 1, réalisé le 21/08/2026 avec la décision sur la connexion (plus bas).
Les parcours **authentifiés** fonctionnent donc en `multi`, et la suite
d'isolation le prouve route par route.

Restent à traiter avant un vrai lancement mutualisé :

- **`GET /api/settings/public` répond 500 en `multi`** : sans JWT, aucun tenant
  n'est résolu et le plugin lève. C'est la route qui habille la page de
  connexion (nom, logo, couleurs). Il faudra déduire le magasin de l'origine
  (sous-domaine ou domaine dédié) — sans quoi, sur une origine partagée, on ne
  sait pas quelle marque afficher avant de savoir qui se connecte.
- **Cache `documents-pdf` du service worker non cloisonné** (dette relevée au
  lot A de Caméléon, à traiter au lot C). `vite.config.ts` met les PDF en
  `NetworkFirst` dans un cache indexé par URL seule. Aujourd'hui sans
  conséquence — chaque magasin a son origine, les factures ont des URL
  uniques, et `/api/` est en `NetworkOnly` (aucune donnée métier cachée).
  Sur une **origine partagée**, un PDF pourrait en revanche être servi d'une
  boutique à l'autre. À régler **avant** toute mise en production mutualisée,
  au même titre que la résolution du magasin par sous-domaine ci-dessus.
- **Le compte propriétaire est une CLÉ MAÎTRESSE, pas un compte d'employé.**
  Depuis le lot C, la liste des boutiques d'un jeton vient du registre
  `Proprietaire` : une boutique lui appartenant devient accessible **même si
  le mot de passe de son compte y diffère** (union registre ∪ boutiques
  prouvées — décision du 22/08/2026, assumée : une seule identité humaine).
  Conséquence : un mot de passe propriétaire compromis ouvre TOUTES ses
  boutiques. Avant qu'un vrai client multi-boutiques passe en production :
  - **mot de passe fort exigé à la création d'un propriétaire** (le contrôle
    actuel se limite à 6 caractères pour le patron d'une boutique) ;
  - **traçabilité renforcée** — fait : chaque bascule est journalisée des deux
    côtés (départ et arrivée), avec horodatage, boutique source et cible ;
  - **notification par e-mail au changement de mot de passe propriétaire** ;
  - **2FA à envisager** — pas maintenant, mais la décision devra être prise
    avant d'héberger des clients qui ne se connaissent pas.
- Attention en écrivant du code hors requête : une **Query Mongoose est
  paresseuse**. `runWithTenant(t, () => model.find(...))` sort du contexte
  avant l'exécution et lève ; il faut `async () => model.find(...).exec()`.

Le code hors requête HTTP (crons) doit s'exécuter dans `runWithTenant(...)` :
voir `fournisseurs.service.ts` pour le motif.

### ✅ Identité avant connexion — tranché le 26/08/2026

La règle dépend du **mode**, parce que la question « à qui appartient cet
écran ? » n'a pas la même réponse selon la façon dont on y est arrivé.

**Mode `single` — un domaine dédié à un client.** L'identité du magasin
s'affiche **partout**, y compris avant connexion : logo, couleurs, nom. Sur
`familystore-pos.netlify.app`, **le domaine EST l'identification** — personne
n'y arrive par hasard. C'est le comportement actuel en production, et il est
conservé. `GET /api/settings/public` existe pour cela.

**Mode `multi` — origine partagée, ou appareil vierge.** Caméléon neutre tant
que la boutique n'a pas été choisie. Avant la connexion, on ne sait pas chez
qui l'on entre : afficher une enseigne serait faux pour tous les autres, et
absurde pour un propriétaire multi-boutiques qui verrait celle de l'une avant
de choisir l'autre.

Trois garanties portent cette seconde règle :

- **l'écran de connexion est immunisé** : ses couleurs sont écrites en dur
  (`pages/Login.tsx`), pas prises dans les variables de thème. Sans cela,
  `couleurPrincipale` — appliquée sur la RACINE du document par
  `SettingsContext` — le teindrait aux couleurs de la dernière boutique ;
- **les défauts du dépôt sont ceux de Caméléon** : nom, thème, manifeste PWA
  et **icônes** (`frontend/public/`). Chaque client surcharge par variables de
  site Netlify, `VITE_BRAND_ICONS` comprise — voir `LOT-E.md` §A4 ;
- **`reinitialiserTheme()` est appelée dans `deconnexion()`** : aucune identité
  ne survit à une déconnexion. Elle ne dépend pas d'un rechargement de page —
  onze déconnexions sur quatorze rechargeaient, trois non, et sur celles-là
  l'écran de connexion gardait l'habillage du magasin quitté. Sur un poste
  partagé, l'utilisateur suivant voyait l'enseigne du précédent.

Corollaire pour les tickets, distinct : le repli d'identité imprimée est
**vide**, jamais une marque — voir `STORE_FALLBACK` dans `ReceiptPrint.tsx`.

### Phase 2 — un magasin = une configuration, plus un fork

Tout ce qui distinguait `radiance-pos` de ce dépôt est devenu de la
**configuration** ; le fork n'a plus de raison d'être (à archiver une fois
Radiance redéployé sur ce code).

- **Langue** : `frontend/src/i18n/index.ts` — `t('fr', 'en')` inline, pas de
  catalogue de clés ; `dateLocale()` pour les dates. La langue vient de
  `Settings.langue` (synchronisée par `SettingsContext`, rechargement de la
  page au changement). **Toute nouvelle chaîne visible doit passer par `t()`.**
  Le backend reste en FR ; ses messages d'erreur sont traduits côté client par
  `i18n/backend-messages.ts` (appliqué dans `api/fetchInterceptor.ts`) —
  **ajouter la traduction là** à chaque nouveau message d'exception.
- **Identité imprimée** (nom, signature « BY RDCT », slogan, mentions légales,
  téléphones du ticket, couleur secondaire) : `Settings`, plus rien en dur.
  Frontend : `storeIdentity(settings)` → `ReceiptData.store` ; backend :
  `ReportsService.brand()`, `MailService.appName()`.
  `GET /api/settings/public` expose l'identité avant connexion (login, PIN).
- **Modules optionnels** : `Settings.modules` (liste vide = tout actif) ;
  `useSettings().hasModule('partenaires')` filtre menus et routes
  (`RequireModule` dans `App.tsx`). Seul `partenaires` est optionnel à ce jour.
- **Règles métier** : `Settings.metier` — `inactiviteMinutes`,
  `seedFournisseursDemo`.
- **Build** : titre, manifeste PWA, langue du document, couleur de thème et URL
  de l'API sont des `VITE_*` (défauts Family Store dans
  `frontend/.env.production`, surcharge par site Netlify — voir `DEPLOY.md`).
  `dist/_redirects` est généré au build ; `netlify.toml` ne porte plus l'URL.
- **Migration à faire avant le déploiement de ce code** :
  `npm run migrate:settings -- --execute` sur la base `familystore` (écrit
  l'identité Family Store historique dans `Settings`). Voir `DEPLOY.md` §6.

Restes connus : `pages/PartenairesAgencesMaquette.tsx` (maquette) non traduite ;
seed des catégories (`categories.service.ts`, `data/categories.ts`) en FR
uniquement ; `desktop-caisse/` porte encore `POS_URL`/`productName` en dur.

### Phase 3 — sécurisation (en cours)

Fait (à déployer avec `npm run migrate:pin -- --execute` AVANT le merge, sur
`familystore` ET la base Radiance — voir l'ordre dans le script) :

- **PIN de caisse** : plus jamais en clair. Base : `{pinKdf, pinSalt}`
  (PBKDF2-SHA256 · 100 000 itérations · 32 octets — contrat figé par
  `backend/test/pin.spec.ts`, partagé avec `frontend/src/utils/pin.ts` qui
  vérifie hors-ligne via WebCrypto). Le jeton transporte la dérivation, pas le
  PIN. L'UI ne peut plus afficher un PIN, seulement en définir un nouveau.
- **Jetons v2** : durée 24 h (`JWT_EXPIRES_IN`), renouvellement glissant
  (`POST /api/auth/refresh`, déclenché par `fetchInterceptor` à mi-vie).
  L'AuthGuard rejette les jetons sans `v: 2` (anciens 30 j, PIN lisible) —
  tous les utilisateurs se reconnectent une fois au déploiement.
- **CORS restreint** : liste blanche (`CORS_ORIGINS`, défaut = les deux sites
  Netlify) + localhost. Radiance appelle son backend en direct : ne jamais
  retirer son origine.

- **Revue du cloisonnement des lectures croisées** (audit §5.3) — conclusions
  verrouillées par `test/tenancy/populate.spec.ts` et `admin-reset.spec.ts` :
  - `populate` : **sûr**, la requête passe par le hook du plugin ; une
    référence pointant vers un autre magasin se résout en `null` ;
  - les trois `$lookup` (`fournisseurs`, `sales`) joignent par `_id`, un
    identifiant globalement unique issu d'un document déjà filtré : pas de
    fuite. **Un `$lookup` sur un autre champ (code, nom, e-mail) serait une
    fuite** — le `$match` du plugin ne protège que la collection source ;
  - `admin.controller.ts` : l'accès brut `connection.collection('users')`
    (hors plugin) est supprimé — en mode multi, une remise à zéro aurait
    supprimé les employés de TOUS les magasins. Règle : **jamais de
    `connection.collection(...)` ni de `db.collection(...)` dans le code
    métier**, toujours un modèle Mongoose.

Reste : cloisonnement du stockage hors-ligne par tenant (sans objet tant que
chaque magasin a son origine ; requis en mode `multi` mutualisé), vrais
refresh tokens révocables.

### ✅ Connexion multi-magasin — tranché le 21/08/2026 : pas de code boutique

L'unicité de l'e-mail est **par tenant** (`{tenant, email}`) : deux magasins
peuvent partager une adresse. La connexion reste néanmoins **à deux champs**.

`AuthService.login` cherche l'e-mail dans tous les magasins (unique usage
autorisé de `skipTenant` dans un service — voir la dérogation nommée dans
`test/tenancy/skip-tenant-governance.spec.ts`), valide le mot de passe sur
chaque candidat, puis :

| Couples valides | Réponse |
|---|---|
| 0 | `401` identique à un mot de passe faux — **plus un calcul bcrypt à vide** pour que la durée ne trahisse pas l'existence du compte |
| 1 | jeton immédiat |
| n | `{ choixBoutique, selectionToken, boutiques[] }` — l'écran « quelle boutique ? » ne liste **que** les magasins où le couple est valide |

Le `selectionToken` (5 min) porte les comptes validés : `POST
/api/auth/login/boutique` refuse tout `tenantId` hors de cette liste. Aucune
information n'est jamais donnée avant validation du mot de passe — l'oracle
d'énumération corrigé le 03/08 ne doit pas se rouvrir.

Éprouvé par `test/tenancy/login-multi-tenant.e2e.spec.ts`.

Contexte : `AUDIT-SAAS.md` §2.4 et `backend/src/schemas/user.schema.ts`.

---

## Structure

```
backend/          NestJS + Mongoose (MongoDB)
frontend/         Vite + React + TypeScript
desktop-caisse/   Electron (caisse hors-ligne)
docs/generateurs/ scripts Python des documents client
design-reference/ maquettes
```

## Commandes

```bash
# backend
npm run build      # nest build
npm test           # jest
npm run seed       # seeds/seed.ts

# frontend
npm run build
```

CI (`.github/workflows/ci.yml`) : le backend doit compiler **et** passer les
tests, le frontend doit compiler. Sur chaque push et chaque PR.

### Piège au premier `npm test`

Les tests utilisent une vraie MongoDB en mémoire (`mongodb-memory-server`). Au
premier lancement, le binaire `mongod` est téléchargé : **≈ 600 Mo**, plusieurs
minutes — bien au-delà du `testTimeout` de 60 s, donc la suite échoue. Le
binaire se pré-télécharge hors Jest, une fois pour toutes ; il est ensuite mis
en cache dans `backend/node_modules/.cache/mongodb-memory-server/`.

Ne jamais lancer `npm ci` sans y penser : il efface `node_modules`, donc ce
cache, et impose un nouveau téléchargement de 600 Mo.

En CI, ce piège ne se manifeste pas : le workflow pose `MONGOMS_DOWNLOAD_DIR`
et met le binaire en cache. Au premier passage sans cache, le téléchargement
observé était de **82 Mo en 16 s**, pas 600 Mo — le chiffre ci-dessus vaut
pour un poste local.

### Point de surveillance — avertissement Jest en fin de suite

Depuis le 24/08/2026, la suite backend se termine par :

> A worker process has failed to exit gracefully… Active timers can also
> cause this, ensure that `.unref()` was called on them.

**Les 204 tests passent** ; l'avertissement n'en fait échouer aucun, et la
cause n'a pas été cherchée. C'est un choix : diagnostiquer une fuite de
handle coûte plus que ce qu'elle gêne aujourd'hui.

À rouvrir **si la CI ralentit** ou si la suite se met à dépasser son délai —
ce sera le premier endroit où regarder. Piste de départ : `--detectOpenHandles`,
et les suites qui démarrent l'application réelle (`test/platform/*.e2e`), dont
les minuteries de relance et de réconciliation sont pourtant en `unref`.

## Conventions

- Messages de commit en français, préfixe conventionnel : `feat(caisse):`,
  `fix(securite):`, `docs(saas):`, `chore(scripts):`, `test(...)`.
- Commentaires et libellés en français côté Family Store.
- **Nomenclature des noms de produits** : toute surface qui affiche un nom de
  produit passe par `displayName()` (frontend, `utils/text.ts`) ou
  `nomProduit()` (backend, `common/nom-produit.ts`) — écrans, tickets,
  étiquettes, toasts, PDF et Excel. Sans quoi le nom brut de la base ressort tel
  quel (« isana paris deospray »), ce que le client relève à chaque livraison.
  La règle est appliquée à l'affichage, **sans altérer les données** ;
  `formatProductName()` (même comportement) sert, lui, à la saisie. Les deux
  implémentations sont des miroirs : modifier l'une impose de modifier l'autre.
- Les `.env` ne sont jamais versionnés ; `.env.example` sert de gabarit.
- `backend/scripts/` contient des scripts qui **visent la base de production**
  (ils réécrivent l'URI de `.env` vers `familystore`). Les lire avant de les
  exécuter.
