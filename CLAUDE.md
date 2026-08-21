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

### 3. Deux clients, une base de code

Ce dépôt sert **deux clients** :

| Client | Langue | Frontend |
|---|---|---|
| **Family Store** | FR | `frontend/` |
| **Radiance POS** | EN | dépôt `radiance-pos` (portage) |

L'unification en **SaaS multi-tenant** est en cours. Conséquence pratique :
avant de coder une règle métier, se demander si elle vaut pour les deux clients
ou seulement pour l'un — et si un libellé doit être traduit.

---

## État du chantier multi-tenant

Mergé sur `main`. Le cloisonnement repose sur un plugin Mongoose appliqué **une
seule fois** à la connexion (`app.module.ts`, via `connectionFactory`) : les
schémas métier héritent du filtrage par tenant sans modification module par
module. Le plugin est *fail-closed* — hors contexte tenant, il lève.

- `backend/src/tenancy/` — contexte CLS (`nestjs-cls`), interceptor HTTP, plugin
- `backend/test/tenancy/` — 4 suites dédiées
- `backend/scripts/migrate-add-tenant.ts` et son rollback
- Modes `single` (production actuelle) et `multi`

Le code hors requête HTTP (crons) doit s'exécuter dans `runWithTenant(...)` :
voir `fournisseurs.service.ts` pour le motif.

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

### ⚠️ Décision produit non tranchée

L'unicité de l'email est passée de **globale** à **par tenant**
(`{tenant, email}`). Deux magasins peuvent donc partager une adresse, ce qui
interdit une connexion à deux champs sans code boutique. Sans effet en mode
single ; **à trancher avant tout lancement mutualisé**.

Contexte : `AUDIT-SAAS.md` §2.4 et le commentaire dans
`backend/src/schemas/user.schema.ts`.

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

## Conventions

- Messages de commit en français, préfixe conventionnel : `feat(caisse):`,
  `fix(securite):`, `docs(saas):`, `chore(scripts):`, `test(...)`.
- Commentaires et libellés en français côté Family Store.
- Les `.env` ne sont jamais versionnés ; `.env.example` sert de gabarit.
- `backend/scripts/` contient des scripts qui **visent la base de production**
  (ils réécrivent l'URI de `.env` vers `familystore`). Les lire avant de les
  exécuter.
