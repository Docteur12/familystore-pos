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

> Le fichier `frontend/netlify.toml` configure automatiquement :
> - le proxy `/api/*` → backend Render
> - le fallback SPA pour les routes React

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
