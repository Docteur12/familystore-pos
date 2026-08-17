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
