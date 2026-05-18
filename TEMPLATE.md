# 🏗️ POS Template — by RDCT

Ce projet sert de base pour déployer rapidement un logiciel de caisse/gestion pour un nouveau client.

---

## ⚡ Démarrage rapide (nouveau client)

### 1. Cloner ce template

```bash
git clone https://github.com/Docteur12/familystore-pos.git mon-nouveau-projet
cd mon-nouveau-projet
git checkout template
```

### 2. Personnaliser en 10 minutes

#### Nom & couleurs — `frontend/src/index.css`
```css
--fs-wine-700: #8B1A2B;   /* ← couleur principale */
--fs-gold-400: #C9A84C;   /* ← couleur accent */
```

#### Nom du magasin — `frontend/src/pages/Login.tsx`
```tsx
<h1>Family Store</h1>   /* ← changer le nom */
<p>by RDCT</p>          /* ← changer le sous-titre */
```

#### Nom dans les reçus — `frontend/src/components/ReceiptPrint.tsx`
```
FAMILY STORE  → NOM DU CLIENT
by RDCT       → sous-titre
```

#### Favicon — regénérer avec `node generate-favicons.js` après avoir changé les couleurs

#### Variables d'environnement backend — `backend/.env`
```
MONGO_URI=mongodb+srv://...nouveau-cluster.../nom-base
JWT_SECRET=nouveau_secret_unique
```

---

## 🗂️ Structure du projet

```
├── backend/          NestJS API
│   ├── src/
│   │   ├── auth/         Authentification JWT
│   │   ├── products/     Catalogue produits
│   │   ├── sales/        Ventes & statistiques
│   │   ├── sessions/     Sessions de travail
│   │   ├── reports/      Rapports PDF/Excel
│   │   ├── factures/     Historique factures
│   │   ├── expenses/     Dépenses
│   │   ├── caisses/      Terminaux de caisse
│   │   ├── admin/        Reset & nettoyage
│   │   └── schemas/      Modèles MongoDB
│
├── frontend/         React + TypeScript
│   ├── src/
│   │   ├── pages/        Pages (Admin, Caisse, Stocks…)
│   │   ├── components/   Composants réutilisables
│   │   ├── api/          Appels API
│   │   ├── hooks/        Hooks custom
│   │   └── contexts/     Contextes React
│
├── backend/render.yaml    Config déploiement Render
└── frontend/netlify.toml  Config déploiement Netlify
```

---

## 👥 Rôles disponibles

| Rôle | Accès |
|---|---|
| `patron` | Tout (admin, rapports, config) |
| `caissier` | Caisse uniquement |
| `gestionnaire` | Gestion du stock |
| `magazinier` | Réceptions & envois |

---

## 🚀 Déploiement

### Backend → Render
1. Créer un nouveau Web Service sur Render
2. Connecter le repo GitHub (branche `template`)
3. Build command : `npm install --include=dev --ignore-scripts && npm run build`
4. Start command : `node dist/main.js`
5. Variables d'env : `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN=7d`

### Frontend → Netlify
1. Connecter le repo GitHub (branche `template`)
2. Base directory : `frontend`
3. Build command : `npm ci && npm run build`
4. Publish directory : `dist`
5. Mettre à jour l'URL du backend dans `frontend/netlify.toml`

---

## 📋 Checklist nouveau client

- [ ] Changer le nom du magasin
- [ ] Changer les couleurs (wine + gold)
- [ ] Changer le favicon
- [ ] Configurer MongoDB Atlas (nouvelle base)
- [ ] Configurer Render (nouveau service)
- [ ] Configurer Netlify (nouveau site)
- [ ] Créer le compte Admin Patron
- [ ] Configurer les caisses (terminaux)
- [ ] Créer les caissiers
- [ ] Ajouter les produits
- [ ] Test complet avant livraison

---

## 🔧 Fonctionnalités incluses

✅ Caisse POS (scan, ticket, reçu thermique)  
✅ Gestion stock (catalogue, réceptions, alertes)  
✅ Rapports (mensuel, trimestriel, annuel, hebdo)  
✅ Comptabilité (TVA, compte de résultat)  
✅ Journal des ventes  
✅ Historique factures  
✅ Sessions de travail  
✅ Audit logs  
✅ Exports Excel/PDF  
✅ Mode hors-ligne (ventes offline + sync)  
✅ Réductions produits  
✅ Multi-caissiers  
✅ Fermeture auto après inactivité (10 min)  
✅ Déploiement Render + Netlify  

---

*Template généré depuis Family Store POS — by RDCT*
