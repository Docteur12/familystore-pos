# Manuel d'utilisation — Family Store POS

**Version** : 1.0
**Date** : Avril 2026
**Éditeur** : RDCT / PHARMATEL
**Application** : Family Store Point de Vente — Douala, Cameroun

---

## Table des matières

1. [Présentation du logiciel](#1-présentation-du-logiciel)
2. [Accès et connexion](#2-accès-et-connexion)
3. [Module Caisse](#3-module-caisse)
4. [Module Stock](#4-module-stock)
5. [Module Administration](#5-module-administration)
6. [Gestion des alertes](#6-gestion-des-alertes)
7. [Exports PDF / Excel](#7-exports-pdf--excel)
8. [Matériel compatible](#8-matériel-compatible)
9. [Support et contact](#9-support-et-contact)

---

## 1. Présentation du logiciel

Family Store POS est un logiciel de point de vente et de gestion de stock conçu pour les commerces de détail au Cameroun. Il fonctionne entièrement dans un navigateur web — aucune installation n'est requise sur les postes clients.

### Architecture

```
Navigateur web (tablette / PC)
        |
        | HTTPS
        v
   Netlify CDN  ──── Interface React (frontend)
        |
        | /api/*
        v
  Render.com  ──── API NestJS (backend)
        |
        v
  MongoDB Atlas ──── Base de données cloud
```

### Trois espaces distincts

| Espace | Accès | Rôle |
|--------|-------|------|
| **Caisse** | `/caisse-pin` | Enregistrement des ventes, scan de produits |
| **Stock** | `/stocks/dashboard` | Gestion du catalogue, réceptions, inventaire |
| **Administration** | `/admin/dashboard` | Rapports, équipe, comptabilité, exports |

### Devises et formats

- Monnaie : **FCFA / XAF**
- Format des dates : **JJ/MM/AAAA**
- Format des nombres : **1 200 000** (espace comme séparateur de milliers)
- Fuseau horaire : **Africa/Douala (UTC+1)**

---

## 2. Accès et connexion

### URLs de production

| Service | URL |
|---------|-----|
| Application (frontend) | `https://familystore-pos.netlify.app` |
| API (backend) | `https://familystore-api.onrender.com/api` |

### Comptes par défaut

> **Important :** Changez les mots de passe par défaut dès la première connexion via Administration > Mon compte.

| Rôle | Email | Mot de passe | Accès |
|------|-------|--------------|-------|
| Patron / Admin | `admin@familystore.cm` | `admin123` | Tout |
| Gestionnaire stock | `stock@familystore.cm` | `stock123` | Module Stock |
| Caissier principal | `caisse@familystore.cm` | `caisse123` + PIN | Caisse uniquement |

### Procédure de connexion

1. Ouvrir l'URL de l'application dans un navigateur (Chrome ou Edge recommandé).
2. Saisir l'**adresse email** et le **mot de passe**.
3. Cliquer sur **Se connecter**.
4. Le système redirige automatiquement vers l'espace correspondant au rôle :
   - `patron` → `/admin/dashboard`
   - `gestionnaire` → `/stocks/dashboard`
   - `caissier` → `/caisse-pin` (saisie du code PIN à 6 chiffres)

### Code PIN caissier

Le caissier utilise deux niveaux d'authentification :

1. **Mot de passe** : pour la connexion initiale (email + mot de passe).
2. **Code PIN** : pour déverrouiller la caisse à chaque session de travail.

Le PIN est défini par le patron dans **Administration > Caissiers** et stocké localement sur le poste. Il ne transite jamais sur le réseau.

### Déconnexion

Cliquer sur l'icône de déconnexion en bas de la barre latérale (flèche sortante). La session est immédiatement invalidée et le token JWT supprimé du navigateur.

---

## 3. Module Caisse

Accessible à l'URL `/caisse` après validation du PIN. Ce module est optimisé pour une utilisation tactile sur tablette.

### 3.1 Interface de la caisse

L'écran est divisé en deux zones :

```
+---------------------------+------------------+
|                           |                  |
|   CATALOGUE PRODUITS      |   PANIER EN COURS|
|   (grille de produits)    |                  |
|                           |  Article 1 ...   |
|   [Scan barcode]          |  Article 2 ...   |
|   [Recherche texte]       |                  |
|                           |  TOTAL : X FCFA  |
|                           |  [ENCAISSER]     |
+---------------------------+------------------+
```

### 3.2 Ajouter un article au panier

**Méthode 1 — Clic sur la grille**
1. Parcourir ou rechercher le produit dans la grille à gauche.
2. Cliquer sur la carte produit pour l'ajouter au panier.
3. Cliquer plusieurs fois pour augmenter la quantité, ou modifier directement le champ quantité dans le panier.

**Méthode 2 — Scan code-barres**
1. Connecter un scanner USB ou utiliser la caméra (bouton QR/barcode).
2. Scanner l'étiquette du produit.
3. Le produit s'ajoute automatiquement au panier.

**Méthode 3 — Recherche textuelle**
1. Saisir le nom ou le SKU du produit dans la barre de recherche.
2. Sélectionner le produit dans les résultats.

### 3.3 Modifier le panier

| Action | Comment |
|--------|---------|
| Augmenter la quantité | Cliquer sur **+** à côté de l'article |
| Diminuer la quantité | Cliquer sur **−** (passe à 0 → supprime l'article) |
| Supprimer un article | Icône poubelle sur la ligne de l'article |
| Vider le panier | Bouton **Annuler** (confirmation demandée) |

### 3.4 Encaissement

1. Vérifier le contenu du panier et le total.
2. Cliquer sur **Encaisser**.
3. Sélectionner le **mode de paiement** :
   - Espèces
   - Mobile Money (Orange Money / MTN MoMo)
   - Carte bancaire
4. Saisir le **montant remis** par le client (pour les espèces).
5. Le logiciel affiche la **monnaie à rendre**.
6. Cliquer sur **Confirmer la vente**.

### 3.5 Reçu de caisse

Après confirmation, le reçu s'affiche à l'écran avec :
- Numéro de transaction
- Date et heure
- Liste des articles (nom, quantité, prix unitaire)
- Total TTC
- Mode de paiement
- Monnaie rendue

**Imprimer le reçu** : cliquer sur le bouton **Imprimer** — le navigateur ouvre la fenêtre d'impression système. Compatible avec les imprimantes thermiques 58 mm et 80 mm.

**Ne pas imprimer** : cliquer sur **Nouvelle vente** pour passer directement à la transaction suivante.

### 3.6 Alertes de stock à la caisse

Si un article vendu passe sous le seuil d'alerte après la vente, une notification s'affiche automatiquement :

```
⚠ Savon Lux Rose 90g — stock bas (8 restants, seuil : 20)
```

Cette alerte est visible par le caissier et est automatiquement remontée dans le module Stock.

---

## 4. Module Stock

Accessible à l'URL `/stocks/dashboard` après connexion avec un compte `gestionnaire` ou `patron`.

### 4.1 Tableau de bord Stock

La page d'accueil du module stock présente :

**Indicateurs clés (KPI)**

| Indicateur | Description |
|-----------|-------------|
| Références | Nombre total de produits actifs dans le catalogue |
| Valeur du stock | Valeur totale au prix d'achat (FCFA) |
| Stock faible | Nombre de produits sous leur seuil d'alerte |
| Réceptions/jour | Nombre de bons de livraison reçus aujourd'hui |

**Graphique 7 jours** : chiffre d'affaires des 7 derniers jours en barres.

**Raccourcis rapides** : accès direct aux sous-modules Réceptions, Inventaire, Alertes, Étiquettes, Fournisseurs, Catalogue.

**À réapprovisionner** : liste des 5 produits les plus critiques avec barre de progression visuelle.

---

### 4.2 Catalogue produits

URL : `/stocks`

Le catalogue centralise tous les produits avec leurs caractéristiques complètes.

**Colonnes du tableau**

| Colonne | Description |
|---------|-------------|
| Produit | Nom + fournisseur associé |
| SKU | Identifiant unique (code-barres ou généré automatiquement) |
| Emplac. | Localisation physique dans l'entrepôt (ex : B-07) |
| Prix | Prix de vente en FCFA |
| Stock | Quantité disponible (rouge si rupture, orange si seuil bas) |
| Seuil | Niveau d'alerte minimum |
| Péremption | Délai avant expiration |

**Filtres disponibles**

- **Tous** : affiche l'ensemble du catalogue
- **Stock bas** : produits sous le seuil d'alerte
- **Péremption proche** : produits expirant dans moins de 6 mois

**Recherche** : par nom de produit, SKU ou fournisseur.

**Panneau détail** : cliquer sur une ligne ouvre un panneau latéral avec :
- Prix de vente, coût d'achat, marge (%)
- Valeur totale du stock
- Emplacement en entrepôt
- Date de péremption
- Fournisseur
- Dernière réception
- Vitesse de vente estimée (unités/jour)
- 6 derniers mouvements (entrées/sorties)

**Ajouter un produit**

1. Cliquer sur **Nouveau produit**.
2. Remplir le formulaire :
   - Nom du produit (obligatoire)
   - Code-barres / EAN (optionnel)
   - Catégorie et unité
   - Prix de vente et prix d'achat
   - Stock initial et seuil d'alerte
3. Cliquer sur **Enregistrer le produit**.

**Réception rapide depuis le catalogue**

Dans le panneau détail, cliquer sur **Réception** pour ajouter du stock immédiatement via un modal avec boutons +10 / +50 / +100 et saisie libre.

---

### 4.3 Réceptions

URL : `/stocks/receptions`

Ce module gère l'entrée de marchandises par **bon de livraison (BL)**.

#### Créer un bon de livraison

**Étape 1 — Entête du BL**

| Champ | Obligatoire | Exemple |
|-------|-------------|---------|
| Fournisseur | Oui | SABC |
| Numéro BL | Non (auto-généré) | BL-2026-047 |
| Date de réception | Oui | 27/04/2026 |

**Étape 2 — Lignes du BL**

Pour chaque produit reçu, renseigner :

| Colonne | Description |
|---------|-------------|
| Produit | Sélectionner par recherche (saisie des premières lettres) |
| Qté attendue | Quantité figurant sur le bon fournisseur |
| Qté reçue | Quantité effectivement comptée à réception |
| Date péremption | Date d'expiration du lot reçu |
| État emballage | Bon état / Endommagé |
| Écart | Calculé automatiquement (reçu − attendu) |

Cliquer sur **Ajouter une ligne** pour chaque produit supplémentaire.

**Étape 3 — Validation**

Cliquer sur **Valider la réception**. Le système :
1. Incrémente le stock de chaque produit selon la quantité reçue.
2. Enregistre un mouvement de stock de type `IN / restock`.
3. Sauvegarde le BL dans l'historique.

#### Historique des réceptions

Basculer sur l'onglet **Historique** pour consulter tous les BLs passés. Chaque BL affiche :
- Numéro, fournisseur, date
- Détail des lignes
- Écart total (vert si excédent, rouge si manque)

---

### 4.4 Inventaire

URL : `/stocks/inventaire`

L'inventaire permet de comparer le stock théorique (base de données) avec le stock réellement compté sur le terrain.

#### Lancer une séance d'inventaire

**Configuration de la séance**

| Option | Description |
|--------|-------------|
| Inventaire total | Tous les produits du catalogue |
| Inventaire partiel | Un seul rayon / une seule catégorie |
| Date | Date de comptage (peut être antérieure) |

**Saisie des quantités comptées**

1. Pour chaque produit, saisir la quantité physiquement comptée dans la colonne **Compté**.
2. Les cases modifiées s'affichent en surbrillance dorée.
3. La colonne **Écart** calcule automatiquement : `compté − théorique`.
4. Si l'écart est non nul, un champ **Justification** apparaît (exemples : vol, casse, erreur saisie, démarque inconnue).

**Validation**

Cliquer sur **Valider (N)** où N est le nombre de produits modifiés. Le système met à jour les stocks et enregistre la séance dans l'historique.

**Export PDF**

Avant de valider, cliquer sur **PDF** pour générer un rapport imprimable de la séance avec tous les écarts et justifications.

#### Historique des inventaires

Consulter toutes les séances passées via l'onglet **Historique**. Chaque séance affiche : date, type (total / partiel), nombre de produits, et le détail des écarts avec justifications.

---

### 4.5 Alertes & Seuils

URL : `/stocks/alertes`

Trois onglets de surveillance :

#### Onglet 1 — Réapprovisionnement

Liste tous les produits dont le stock est inférieur ou égal au seuil d'alerte, triés par urgence :

| Statut | Condition | Couleur |
|--------|-----------|---------|
| **Rupture** | Stock = 0 | Rouge foncé |
| **Critique** | Stock ≤ 40 % du seuil | Orange |
| **Alerte** | Stock ≤ seuil | Jaune |

**Modifier un seuil** : saisir la nouvelle valeur dans la colonne **Modifier seuil** et cliquer sur la coche verte.

#### Onglet 2 — Péremption proche

Affiche les produits dont la date de péremption approche. Filtrer par délai :
- **≤ 30 jours** : action urgente
- **≤ 90 jours** : à surveiller
- **≤ 180 jours** : anticipation

#### Onglet 3 — Suggestions auto

Le système calcule automatiquement les quantités à commander :

```
Qté recommandée = (2 × seuil d'alerte) − stock actuel
```

Exemple : seuil = 20, stock actuel = 5 → commander +35 unités.

**Récap email** : le bouton **Récap email** ouvre le client de messagerie avec un résumé pré-rédigé de toutes les alertes actives, prêt à envoyer au fournisseur.

---

### 4.6 Étiquettes / SKU

URL : `/stocks/etiquettes`

Génère et imprime les étiquettes produits avec code-barres.

**Sélectionner des produits**

- Cliquer sur chaque étiquette pour la sélectionner (contour bordeaux + coche).
- Bouton **Tout sélectionner** pour sélectionner tous les produits affichés.
- La barre de recherche filtre par nom ou SKU.

**Formats d'étiquettes**

| Format | Dimensions | Usage |
|--------|-----------|-------|
| **Mini** | 57 × 32 mm | Petits articles, étagères |
| **Standard** | 90 × 50 mm | Usage général |
| **Grande** | 100 × 70 mm | Produits volumineux, vitrine |

Chaque étiquette contient :
- Bandeau couleur catégorie
- Nom du produit
- Code-barres (format Code39)
- Référence SKU
- Prix de vente en FCFA
- Unité

**Impression**

Cliquer sur **Imprimer (N)** pour ouvrir la fenêtre d'impression avec toutes les étiquettes sélectionnées. Chaque étiquette occupe une page au format défini — compatible avec les imprimantes d'étiquettes thermiques.

---

### 4.7 Dépôts

URL : `/stocks/depots`

Gère les emplacements physiques de stockage.

**Vue Dépôts**

Affiche les fiches de chaque dépôt :
- Nom, ville, adresse
- Localisation interne (ex : Bâtiment A, Allée A-12)
- Téléphone
- Nombre de références stockées

Le **Dépôt principal** est non supprimable.

**Ajouter un dépôt**

1. Cliquer sur **Nouveau dépôt**.
2. Renseigner : nom, ville, adresse, téléphone, localisation interne.
3. Cliquer sur **Enregistrer**.

**Vue Transferts**

Enregistre les mouvements de marchandises entre dépôts.

1. Cliquer sur **Nouveau transfert**.
2. Sélectionner : dépôt source, dépôt destination, produit, quantité, date.
3. Cliquer sur **Enregistrer le transfert**.

L'historique des transferts reste accessible dans la vue Transferts.

---

### 4.8 Fournisseurs

URL : `/stocks/fournisseurs`

Répertoire complet des fournisseurs avec leurs conditions commerciales.

**Informations par fournisseur**

| Champ | Description |
|-------|-------------|
| Nom | Raison sociale du fournisseur |
| Contact | Nom du responsable commercial |
| Téléphone / Email | Coordonnées directes |
| Adresse | Localisation (ville, pays) |
| Conditions de paiement | Comptant / 30 jours / 60 jours |
| Remise commerciale | Pourcentage de réduction négocié |
| Note de fiabilité | 1 à 5 étoiles (évaluation interne) |
| Catégories fournies | Rayons couverts par ce fournisseur |

**Ajouter un fournisseur**

1. Cliquer sur **Nouveau fournisseur**.
2. Remplir le formulaire complet.
3. Attribuer une note de fiabilité (1 à 5 étoiles).
4. Cocher les catégories de produits fournies.
5. Cliquer sur **Enregistrer**.

**Modifier un fournisseur**

Cliquer sur l'icône crayon sur la ligne du fournisseur. Le même formulaire s'ouvre pré-rempli.

**Supprimer un fournisseur**

Cliquer sur l'icône poubelle. La suppression est immédiate (pas de corbeille).

---

## 5. Module Administration

Accessible à l'URL `/admin/dashboard` avec un compte `patron`.

### 5.1 Dashboard administrateur

Vue synthétique de l'activité du magasin :

**Indicateurs du jour**
- Chiffre d'affaires du jour
- Nombre de ventes
- Bénéfice estimé
- Marge moyenne (%)

**Graphique hebdomadaire** : CA et nombre de ventes sur 7 jours glissants.

**Top produits** : les 5 produits les plus vendus en valeur et en volume.

---

### 5.2 Équipe

Sous-menu **Équipe** avec trois sections :

#### Caissiers (`/admin/caissiers`)

Liste tous les caissiers avec leur statut. Actions disponibles :

| Action | Description |
|--------|-------------|
| Créer un caissier | Nom, email, rôle, PIN à 6 chiffres |
| Modifier | Changer le nom ou réinitialiser le PIN |
| Voir les rapports | Historique des ventes par caissier |
| Supprimer | Retirer le compte (confirmation requise) |

> Le caissier n'a **pas** de mot de passe modifiable ici — il utilise son PIN. La réinitialisation du mot de passe de connexion se fait via **Modifier**.

#### Gestionnaires (`/admin/gestionnaires`)

Même fonctionnement que les caissiers, pour les comptes `gestionnaire`.

#### Toute l'équipe (`/admin/equipe`)

Vue consolidée de tous les membres, toutes fonctions confondues.

---

### 5.3 Rapports

URL : `/admin/rapports`

Génère des rapports de performance sur différentes périodes.

**Rapports disponibles**

| Rapport | Contenu |
|---------|---------|
| Rapport journalier | CA, ventes, marge, top produits du jour |
| Rapport hebdomadaire | Évolution sur 7 jours |
| Rapport mensuel | Synthèse mensuelle avec comparaison M-1 |

**Générer un rapport**

1. Sélectionner la période (date de début / date de fin).
2. Choisir le format : **Afficher** (à l'écran) ou **Télécharger PDF**.
3. Cliquer sur **Générer**.

---

### 5.4 Journal d'activité

URL : `/admin/journal`

Trace toutes les actions effectuées dans le système :
- Connexions / déconnexions
- Ventes enregistrées
- Modifications de stock
- Ajouts / suppressions de produits
- Modifications de comptes utilisateurs

Filtrable par date, par utilisateur et par type d'action.

---

### 5.5 Comptabilité

URL : `/admin/comptabilite`

Suivi des dépenses et de la trésorerie :
- Enregistrement des dépenses (loyer, fournitures, salaires, etc.)
- Catégorisation par nature de charge
- Solde de caisse estimé (recettes − dépenses)

---

### 5.6 Rôles et permissions

URL : `/admin/roles`

Tableau récapitulatif des droits par rôle :

| Fonctionnalité | Patron | Gestionnaire | Caissier |
|----------------|--------|--------------|---------|
| Vente en caisse | — | — | Oui |
| Voir le catalogue | Oui | Oui | Oui |
| Modifier les stocks | Oui | Oui | Non |
| Créer des produits | Oui | Non | Non |
| Accès rapports | Oui | Non | Non |
| Gérer l'équipe | Oui | Non | Non |
| Accès comptabilité | Oui | Non | Non |
| Exports | Oui | Non | Non |

---

### 5.7 Paramètres

URL : `/admin/parametres`

**Mon compte** : modifier son propre nom et mot de passe.

**Informations du magasin** : nom, adresse, téléphone, devise (affiché sur les reçus).

---

## 6. Gestion des alertes

### 6.1 Badge d'alerte dans la sidebar

Le nombre de produits en stock bas est affiché en badge rouge sur le menu **Alertes & seuils** dans la barre latérale du module stock. Ce badge se met à jour à chaque chargement de page.

### 6.2 Niveaux d'alerte

Trois niveaux de gravité sont utilisés dans tout le logiciel :

| Niveau | Condition | Affichage |
|--------|-----------|-----------|
| **Alerte** | Stock ≤ seuil d'alerte | Fond jaune |
| **Critique** | Stock ≤ 40 % du seuil | Fond orange |
| **Rupture** | Stock = 0 | Fond rouge |

### 6.3 Définir ou modifier un seuil d'alerte

**Méthode 1 — Via le catalogue** : cliquer sur un produit → panneau détail → le seuil est visible. Utiliser le bouton **Modifier** pour l'ajuster.

**Méthode 2 — Via Alertes & seuils** : dans l'onglet Réapprovisionnement, saisir directement la nouvelle valeur dans la colonne **Modifier seuil**.

**Méthode 3 — Via la page produit** : lors de la création ou modification d'un produit, le champ **Seuil d'alerte** est toujours accessible.

### 6.4 Récapitulatif email

Dans Alertes & seuils, le bouton **Récap email** génère automatiquement un email avec :
- La liste de tous les produits en rupture et en alerte
- Les quantités actuelles et les seuils
- La date du jour

L'email s'ouvre dans le client de messagerie par défaut du poste (Outlook, Gmail, etc.) prêt à être envoyé au fournisseur ou au responsable des achats.

### 6.5 Alertes péremption

Les produits approchant de leur date de péremption sont signalés dans deux endroits :
1. **Catalogue** : colonne Péremption avec badge coloré (vert > 6 mois / orange < 6 mois / rouge < 1 mois)
2. **Alertes & seuils > Péremption proche** : vue dédiée avec filtre 30 / 90 / 180 jours

---

## 7. Exports PDF / Excel

### 7.1 Exports disponibles

| Document | Format | Accès |
|----------|--------|-------|
| Reçu de caisse | PDF (impression navigateur) | Après chaque vente |
| Rapport journalier | PDF | Administration > Rapports |
| Rapport hebdomadaire | PDF | Administration > Rapports |
| Rapport mensuel | PDF | Administration > Rapports |
| Feuille d'inventaire | PDF | Inventaire > bouton PDF |
| Étiquettes produits | PDF (impression multi-pages) | Étiquettes > Imprimer (N) |

URL : `/admin/exports`

### 7.2 Exporter depuis Administration > Exports

1. Aller dans **Administration > Exports**.
2. Sélectionner le type de document.
3. Choisir la période si applicable.
4. Cliquer sur **Télécharger**.

Le fichier est envoyé directement par le serveur et téléchargé par le navigateur.

### 7.3 Imprimer un reçu de caisse

Après validation d'une vente :
1. Cliquer sur **Imprimer le reçu**.
2. La fenêtre d'impression système s'ouvre.
3. Sélectionner l'imprimante thermique (voir section 8).
4. Imprimer.

> Pour les impressions thermiques, désactiver les en-têtes et pieds de page dans les options d'impression du navigateur.

### 7.4 Imprimer des étiquettes

1. Aller dans **Stock > Étiquettes / SKU**.
2. Sélectionner le format (Mini / Standard / Grande).
3. Cocher les produits souhaités.
4. Cliquer sur **Imprimer (N)**.
5. Dans la fenêtre d'impression, sélectionner l'imprimante d'étiquettes.
6. Vérifier que le format papier correspond au format choisi.

---

## 8. Matériel compatible

Family Store POS fonctionne dans tout navigateur web moderne. Aucun pilote ni plugin n'est requis.

### 8.1 Navigateurs recommandés

| Navigateur | Version minimum | Recommandé |
|------------|----------------|-----------|
| Google Chrome | 100+ | Oui (prioritaire) |
| Microsoft Edge | 100+ | Oui |
| Mozilla Firefox | 100+ | Compatible |
| Safari (iPad) | 15+ | Compatible tablette |

> Internet Explorer n'est **pas** supporté.

### 8.2 Postes de travail

| Poste | Configuration minimale |
|-------|----------------------|
| PC Windows | Windows 10, 4 Go RAM, résolution 1280×720 |
| PC Linux | Ubuntu 20.04+, Chrome installé |
| Tablette Android | Android 10+, Chrome, écran 10" recommandé |
| iPad | iPadOS 15+, Safari ou Chrome |

### 8.3 Scanners de codes-barres

Tout scanner USB en mode **HID (clavier)** est compatible — il envoie les données comme une frappe clavier, aucune configuration requise.

| Type | Connexion | Compatibilité |
|------|-----------|--------------|
| Scanner USB filaire | USB | Plug & play |
| Scanner USB sans fil | Dongle USB | Plug & play |
| Scanner Bluetooth | Bluetooth | Compatible (appairage OS requis) |
| Caméra intégrée (tablette) | — | Via le module QR intégré |

**Codes-barres supportés** : EAN-13, EAN-8, Code39, Code128, QR Code.

### 8.4 Imprimantes

**Reçus de caisse**

| Modèle recommandé | Largeur papier | Connexion |
|-------------------|---------------|-----------|
| Epson TM-T20III | 80 mm | USB / Réseau |
| Epson TM-T82III | 80 mm | USB / Bluetooth |
| HOIN HOP-E801 | 80 mm | USB |
| Imprimante générique 58 mm | 58 mm | USB |

> Configurer l'imprimante comme imprimante par défaut Windows. L'impression se fait via le navigateur (Ctrl+P).

**Étiquettes produits**

| Modèle recommandé | Formats supportés | Connexion |
|-------------------|------------------|-----------|
| Dymo LabelWriter 450 | 57×32 mm, 89×36 mm | USB |
| Brother QL-800 | 62 mm, 102 mm | USB |
| Zebra ZD220 | Tous formats | USB / Réseau |
| Imprimante A4 classique | Formats Grande (100×70) | USB |

### 8.5 Réseau

L'application nécessite une **connexion Internet** pour communiquer avec le serveur (MongoDB Atlas + Render.com).

| Connexion | Débit minimum recommandé |
|-----------|--------------------------|
| WiFi professionnel | 5 Mbps |
| 4G mobile | 3 Mbps |
| Fibre / ADSL | 2 Mbps |

> En cas de coupure Internet, les données ne sont pas accessibles. Prévoir une connexion de secours (partage de connexion mobile).

---

## 9. Support et contact

### 9.1 Éditeur et intégrateur

```
PHARMATEL / RDCT
Développement et intégration : Family Store POS
Douala, Cameroun
```

### 9.2 Contacts support

| Type de demande | Contact | Disponibilité |
|-----------------|---------|---------------|
| Support technique | support@pharmatel.cm | Lun–Ven 8h–18h |
| Urgence (panne caisse) | +237 6XX XXX XXX | 7j/7 8h–20h |
| Demande de formation | formation@pharmatel.cm | Lun–Ven |
| Facturation / Contrat | admin@pharmatel.cm | Lun–Ven 8h–17h |

### 9.3 Procédure en cas de problème

**Problème de connexion**
1. Vérifier la connexion Internet du poste.
2. Vider le cache du navigateur (Ctrl+Shift+Del).
3. Essayer depuis un autre navigateur.
4. Contacter le support si le problème persiste.

**Vente impossible (erreur 401 / 403)**
1. Se déconnecter et se reconnecter.
2. Vérifier que le compte est actif (patron → Administration > Caissiers).
3. Si le problème persiste : contacter le support avec une capture d'écran de l'erreur.

**Stock incorrect après inventaire**
1. Ne pas faire d'inventaire plusieurs fois le même jour sur les mêmes produits.
2. Contacter le support pour correction manuelle en base de données si nécessaire.

**Perte du code PIN caissier**
1. Se connecter en tant que `patron`.
2. Aller dans **Administration > Caissiers**.
3. Cliquer sur **Modifier** sur le caissier concerné.
4. Saisir un nouveau PIN à 6 chiffres.
5. Communiquer le nouveau PIN au caissier.

### 9.4 Mises à jour

Les mises à jour du logiciel sont déployées automatiquement sur Netlify (frontend) et Render (backend). Aucune action manuelle n'est requise côté utilisateur. Un rechargement de la page (F5) suffit pour bénéficier de la dernière version.

### 9.5 Sauvegarde des données

Les données sont stockées sur **MongoDB Atlas (cloud M0)** avec réplication automatique dans le data center le plus proche. Les sauvegardes automatiques sont gérées par MongoDB Atlas selon leur politique de rétention.

Pour une sauvegarde manuelle :
1. Aller dans **Administration > Exports**.
2. Exporter les rapports souhaités en PDF.
3. Conserver les fichiers sur un support externe.

---

*Document généré le 27 avril 2026 — Family Store POS v1.0*
*RDCT / PHARMATEL — Douala, Cameroun*
