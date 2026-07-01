# RECAP — Phase 1 (backend) : Partenaires, agences & circuit magazinier

> **Nature :** ajouts uniquement. Aucun comportement existant modifié.
> Tous les nouveaux champs ont une valeur par défaut sûre ; le nouveau code reste
> « dormant » tant que le frontend (Phase 2) ne l'utilise pas.

## Décisions validées (rappel)

- **Agences** : sous-entités d'un partenaire. Chaque agence « règle sa propre dette »
  (indépendante) ou est en « dette commune ».
  - Santa Lucia = toutes indépendantes ; Goutelot/Rebecca = communes ; cas mixte possible.
- **Versements** : par agence (indépendantes) ou global/libre (communes & particuliers).
- **CRUD + archivage** : partenaires et agences avec historique sont **archivés**, jamais effacés.
- **Circuit** : le **magazinier fait tout** (commande → préparation/livraison → versements).
- **Qté commandée ≠ qté livrée** : le magazinier saisit ce qu'il sort réellement.
- **Reliquat ouvert** : si 60/100 servis, il reste 40 à servir au réassort.
- **Présentoir Mabanda** : point de vente interne → Phase 3.

## Fichiers

**Nouveau**
- `backend/src/schemas/agence.schema.ts`

**Champs ajoutés (optionnels, défaut)**
- `partenaire.schema.ts` → `type` (`structure`/`particulier`, défaut *structure*), `archivee` (*false*)
- `commande-partenaire.schema.ts` → `agence` (*null*), `lignes[].quantiteLivree` (*0*), statut `partielle`
- `livraison-partenaire.schema.ts` → `agence` (*null*), `commande` (*null*)
- `paiement-partenaire.schema.ts` → `agence` (*null* = versement commun/global)

**Câblage / logique**
- `partenaires.module.ts` → enregistrement du modèle `Agence`
- `partenaires.service.ts` → injection `agenceModel` ; `agence` optionnelle sur create commande/livraison/paiement ;
  `type` sur partenaire ; nouvelles méthodes (voir ci-dessous)
- `partenaires.controller.ts` → nouvelles routes (ci-dessous) ; champs optionnels dans les corps

## Nouvelles routes API (les anciennes sont inchangées)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/partenaires/agences?partenaireId=` | Lister les agences (option : d'un partenaire) |
| POST | `/api/partenaires/agences` | Créer une agence `{ partenaireId, nom, ville?, telephone?, responsable?, independante? }` |
| PATCH | `/api/partenaires/agences/:aid` | Modifier `{ nom?, ville?, telephone?, responsable?, independante?, archivee? }` |
| DELETE | `/api/partenaires/agences/:aid` | Supprimer **ou archiver** si historique → `{ archived, deleted }` |
| POST | `/api/partenaires/commandes/:cid/preparer` | Livrer les **quantités servies** `{ lignes:[{productId,quantite,prixUnitaire?}], montantPaye?, date?, numeroBL? }` |
| GET | `/api/partenaires/:id/compte-agences` | Dette **par agence / commune / globale** |
| GET | `/api/partenaires/stats-agences` | Top débiteurs ventilé par agence |

### Champs optionnels ajoutés aux routes existantes
- `POST /partenaires` et `PATCH /partenaires/:id` → `type`, `archivee`
- `POST /partenaires/commandes` → `agenceId`
- `POST /partenaires/:id/livraisons` → `agenceId`, `commandeId`
- `POST /partenaires/:id/paiements` → `agenceId`

## Règles métier ajoutées

- **`preparerCommande`** : sort le `stockMagazin`, crée un `LivraisonPartenaire` (hérite l'agence de la
  commande, lie la commande), met à jour `quantiteLivree` par ligne, passe la commande en
  `recue`/`partielle`/`livree` selon le reliquat.
- **`deleteAgence`** : si l'agence a un historique (commande/livraison/versement) → `archivee = true`
  (conservée) ; sinon suppression.
- **`getCompteAgences`** :
  - solde d'une agence indépendante = `livré(agence) − payé(agence) − versé(agence)`
  - dette commune = `livré(non-indép) − payé − versements communs − retours`
  - solde global = `total livré − payé − versements − retours`
- **`getStatsAgences`** : une ligne de débiteur par agence indépendante + une ligne « dette commune »
  par partenaire, triées par solde décroissant.

## Vérifications

- `npx tsc --noEmit` (backend) → **OK, aucune erreur**.
- Validation globale `whitelist: true` → sans effet sur ces corps (types inline, pas de classes) :
  les nouveaux champs passent bien jusqu'au service.

## Reste à faire

- **Phase 2 — Frontend** : gestion des agences, commande avec agence, onglet « À préparer »
  (saisie des quantités servies), comptes & tableau de bord par agence (remplace la maquette
  `/maquette/agences`).
- **Phase 3 — Présentoir Mabanda** : point de vente interne.
