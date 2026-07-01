# RECAP — Phase 2 (frontend) & Phase 3 (présentoir)

> Suite de `RECAP_PHASE1.md` (backend). Tout est branché sur la vraie page `/partenaires`,
> dans le design FamilyStore (barre wine, ivoire, mêmes cartes/police).

## Phase 2 — UI livrée (incréments 1→6)

1. **Fondation** — champs backend additifs (`ville`, `quartier`, `responsable`, `email` sur partenaire ;
   `quartier` sur agence) + couche API frontend (`getAgences`/`createAgence`/`updateAgence`/`deleteAgence`,
   `preparerCommande`, `getCompteAgences`, `getStatsAgences`).
2. **Onglet Partenaires** — fiche d'inscription complète (type, responsable, ville, quartier, email, note)
   + gestion des agences (ajouter/modifier modal, rendre indépendante / dette commune, archiver/supprimer,
   réactiver).
3. **Onglet Commandes** — sélecteur d'**agence** + badge agence + statut « Partielle ».
4. **Onglet « À préparer »** (nouveau) — le magazinier saisit les **quantités servies** (commandé / déjà livré /
   reste / stock entrepôt). Vide = sert tout le reste. **Reliquat gardé ouvert** (la commande revient tant
   qu'elle n'est pas complète).
5. **Onglet Comptes** — **dette par agence** (mode, qté cmd/livrée, livré, versé, solde) + totaux
   agences indép. / commune / globale + **versement ciblé** (agence indépendante ou dette commune).
6. **Tableau de bord** — top débiteurs **ventilé par agence / commune**.

Fichiers principaux : `frontend/src/pages/Partenaires.tsx`, `frontend/src/api/partenaires.ts`.
Proxy Vite `/api` → `http://localhost:3004` (= port backend).

## Phase 3 — Présentoir Mabanda

**Décision : le présentoir est géré comme un partenaire ordinaire.** Il suffit de créer un partenaire
nommé « Présentoir Mabanda » (type particulier, sans agence). **Aucun code dédié.**

Interprétation des chiffres pour ce partenaire :
- **Livré** = valeur des produits sortis du magasin vers le présentoir (décrémente le stock entrepôt) ;
- **Versé** = recette ramenée des ventes ;
- **« Dette »** = valeur des marchandises encore au présentoir, non encore encaissées (stock sur place).

## État

- Backend Phase 1 + champs Phase 2 : compile, démarre (port 3004).
- Frontend Phase 2 : `tsc --noEmit` OK.
- Maquette `/maquette/agences` : habillée de la coquille FamilyStore + présentoir affiché comme partenaire.

## Détails / à nettoyer

- `frontend/src/pages/Partenaires.tsx` : la fonction `genererBL` (ancien flux « livrer tout ») n'est plus
  câblée (remplacée par l'onglet « À préparer »). Inoffensive ; peut être retirée.
