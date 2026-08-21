# Déploiement — Family Store POS

## Prérequis
- Compte [GitHub](https://github.com)
- Compte [Netlify](https://netlify.com) (frontend gratuit)
- Compte [Render](https://render.com) (backend gratuit)
- Base de données [MongoDB Atlas](https://cloud.mongodb.com) (cluster gratuit M0)

---

## Étape 1 — Pousser le code sur GitHub

```bash
# À la racine du projet familystore-pos/
git init
git add .
git commit -m "Initial commit — Family Store POS"

# Créer un repo sur github.com, puis :
git remote add origin https://github.com/TON_USERNAME/familystore-pos.git
git push -u origin main
```

---

## Étape 2 — Déployer le Frontend sur Netlify

1. Aller sur [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
2. Connecter ton compte GitHub et sélectionner le repo `familystore-pos`
3. Paramètres de build :
   - **Base directory** : `frontend`
   - **Build command** : `npm run build`
   - **Publish directory** : `frontend/dist`
4. Cliquer **Deploy site**

> Le proxy `/api/*` → backend Render (URL Family Store) et le fallback SPA
> sont déclarés dans `frontend/netlify.toml`.

5. **Un site Netlify par magasin, un seul dépôt.** Les valeurs par défaut du
   build (Family Store) sont dans `frontend/.env.production`. Pour un autre
   magasin (ex. Radiance), surcharger dans **Site settings → Environment
   variables** du site Netlify concerné :

   | Variable | Family Store (défaut) | Exemple Radiance |
   |---|---|---|
   | `VITE_APP_NAME` | `Family Store POS` | `Radiance POS` |
   | `VITE_APP_SHORT_NAME` | `Family Store` | `Radiance` |
   | `VITE_APP_LANG` | `fr` | `en` |
   | `VITE_THEME_COLOR` | `#8B1A2B` | `#221C1A` |
   | `VITE_BG_COLOR` | `#F5F0E8` | `#FCF8EA` |
   | `VITE_API_BASE` | *(vide — proxy Netlify)* | `https://<service-radiance>.onrender.com` |

   `VITE_API_BASE` vide (Family Store) : les appels `/api` passent par le proxy
   du `netlify.toml` (qui porte l'URL Family Store en dur — un `_redirects`
   généré par site ne marche pas : Netlify transmet alors l'hôte d'origine à
   Render, qui le rejette ; incident du 21/08/2026). `VITE_API_BASE` renseignée
   (tout autre magasin) : le frontend appelle **directement** ce backend Render,
   sans proxy (CORS ouvert côté NestJS).

   Tout le reste (nom du magasin, logo, couleurs de l'interface, langue de
   l'interface, slogan, mentions légales du ticket, téléphones, modules
   activés, règles métier) se règle **dans l'application** — Paramètres
   magasin — et vit dans le document `Settings` de la base du magasin.

6. **Migration des paramètres (une fois, avant le premier déploiement de ce
   code)** : l'en-tête des tickets (« BY RDCT », slogan, NIU/RC, téléphones)
   n'est plus codé en dur ; il est lu dans `Settings`. Pour que rien ne
   disparaisse des tickets Family Store : sauvegarde → depuis `backend/`, avec
   `MONGO_URI` visant la base **`familystore`** (la `.env` locale vise
   `familystore_test`), `npm run migrate:settings` (dry-run) puis
   `npm run migrate:settings -- --execute` → merge/push. Le script n'écrit que
   les champs vides ; il est idempotent.

---

## Étape 3 — Déployer le Backend sur Render

1. Aller sur [render.com](https://render.com) → **New** → **Web Service**
2. Connecter ton compte GitHub et sélectionner le repo `familystore-pos`
3. Paramètres :
   - **Root Directory** : `backend`
   - **Environment** : `Node`
   - **Build Command** : `npm install --include=dev && npm run build`
   - **Start Command** : `node dist/main.js`
4. Dans l'onglet **Environment**, ajouter les variables secrètes :

   | Variable | Valeur |
   |---|---|
   | `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/familystore` |
   | `JWT_SECRET` | Une clé aléatoire longue (ex: `openssl rand -hex 32`) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `EMAIL_USER` | Ton adresse Gmail |
   | `EMAIL_PASS` | App Password Google (16 caractères) |
   | `EMAIL_ALERT_TO` | Email du patron pour les alertes stock |

5. Cliquer **Create Web Service**

> Le fichier `backend/render.yaml` est déjà configuré avec `NODE_ENV=production` et `PORT=3000`.

---

## Vérification finale

Une fois les deux déployés :

- Frontend Netlify : `https://familystore-pos.netlify.app`
- Backend Render : `https://familystore-api.onrender.com/api`

Tester l'API : `https://familystore-api.onrender.com/api` doit répondre.

> **Note Render plan gratuit** : le backend se met en veille après 15 min d'inactivité.
> Le premier appel après la veille prend ~30 secondes (cold start).

---

## Bascule Radiance sur ce dépôt (fin du fork)

Préparé le 21/08/2026 — la base `radiance` (même cluster Atlas) est **déjà
migrée** : `migrate:tenant` (exécuté + vérifié, zéro écart) et
`migrate:settings --identite=radiance` (identité EN, couleurs noir/or, pas de
module Partenaires, inactivité 30 min, pas de fournisseurs de démo).
Sauvegarde : base `radiance_backup_20260821`.

Reste à faire dans les dashboards (comptes Radiance) :

1. **Render** — créer un service web depuis `Docteur12/familystore-pos`
   (Root Directory `backend`, build `npm install --include=dev && npm run build`,
   start `node dist/main.js`) avec les variables de l'ancien service
   `radiance-api` (MONGO_URI vers la base `radiance`, JWT_SECRET, EMAIL_*),
   plus `APP_NAME=Radiance POS` et `TENANT_MODE=single`.
   (Render ne permet pas de changer le dépôt d'un service existant.)
2. **Netlify** — sur le site Radiance : Build settings → repo
   `Docteur12/familystore-pos` (base `frontend`), et renseigner les variables
   du tableau ci-dessus, dont `VITE_API_BASE` = l'URL du service Render créé
   en 1. Redéployer.
3. Vérifier : login (identité Radiance sur la page), un ticket test (en-tête
   « Radiance », slogan EN, NIU/RC, téléphones), pas d'entrée Partenaires.
4. **Archiver le dépôt `radiance-pos`** (GitHub → Settings → Archive) et
   supprimer l'ancien service Render `radiance-api`.

Fenêtre horaire : Radiance est une boutique en activité — mêmes règles
(avant 9 h ou après fermeture).
