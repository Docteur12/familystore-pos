# Family Store POS

Monorepo Point de Vente (POS) — NestJS + React 18.

```
familystore-pos/
├── backend/   → API NestJS + MongoDB + JWT
└── frontend/  → React 18 + Vite + Tailwind
```

---

## Prérequis

- Node.js >= 18
- MongoDB (local ou Atlas)

---

## Backend

```bash
cd backend
cp .env.example .env
# Editer .env (MONGODB_URI, JWT_SECRET)
npm install
npm run dev
```

Serveur : `http://localhost:3000/api`
Health check : `GET /api/health`

### Variables d'environnement

| Variable        | Description                        | Défaut                                   |
|-----------------|------------------------------------|------------------------------------------|
| `MONGODB_URI`   | URI de connexion MongoDB           | `mongodb://localhost:27017/familystore`  |
| `JWT_SECRET`    | Clé secrète JWT                    | —                                        |
| `JWT_EXPIRES_IN`| Durée de validité du token         | `7d`                                     |
| `PORT`          | Port du serveur                    | `3000`                                   |

### Schemas MongoDB

**Product** — `name`, `barcode`, `price`, `costPrice`, `stock`, `alertThreshold`, `category`, `unit`
**Sale** — `items[{product, quantity, unitPrice}]`, `total`, `paymentMethod`, `createdAt`
**Expense** — `amount`, `category`, `description`, `date`

---

## Frontend

```bash
cd frontend
npm install
npm run dev
```

App : `http://localhost:5173`

### Palette de couleurs

| Nom      | Code      |
|----------|-----------|
| Bordeaux | `#8B1A2B` |
| Gold     | `#C9A84C` |
| Cream    | `#F5F0E8` |

---

## Démarrage rapide (deux terminaux)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```
