# Essayer Caméléon en local

Trois boutiques, un propriétaire, des données réalistes — et rien qui touche
une base client.

L'environnement vit dans une base **à part** (`cameleon_demo`, port 27018).
Le script de mise en place **efface la base qu'il vise** et refuse de partir si
son nom ne contient pas « demo », ou s'il ressemble à celui d'un client.

---

## Démarrer — trois fenêtres

Chaque commande reste ouverte. Lancez-les dans cet ordre.

> Les chemins sont donnés en ENTIER. Un terminal s'ouvre dans
> `C:\Users\<vous>`, pas dans le projet : un simple `cd backend` échoue avec
> « Le chemin d'accès spécifié est introuvable ».

### 1. La base

```
cd /d C:\Users\Tatcheu\Projets\familystore-pos\backend
npm run demo:mongo
```

Réutilise le `mongod` déjà téléchargé pour les tests — rien à installer. Les
données sont écrites dans `backend/.demo-db` et **survivent** à l'arrêt : vous
retrouverez votre démonstration demain sans tout resemer.

> Au tout premier lancement, si le binaire n'est pas en cache, il se télécharge
> (~600 Mo, quelques minutes).

### 2. Les données

Dans une **deuxième** fenêtre, une seule fois :

```
cd /d C:\Users\Tatcheu\Projets\familystore-pos\backend
npm run seed:demo
```

Le script imprime, à la fin, **les chiffres attendus dans le rapport
consolidé**. Gardez-les sous les yeux : c'est votre point de comparaison.

Rejouable à volonté — il repart d'une base vide à chaque fois.

### 3. Le backend

Dans la **même** fenêtre que le seed, une fois celui-ci terminé :

```
npm run demo:api
```

Démarre sur le port **3004** (celui que le frontend relaie), en mode
`multi`, avec **`PAIEMENT_FOURNISSEUR=simule`** : le bouton « + » fonctionne
sans qu'un franc soit encaissé.

### 4. Le frontend

Dans une **troisième** fenêtre :

```
cd /d C:\Users\Tatcheu\Projets\familystore-pos\frontend
npm run dev
```

Puis ouvrez **http://localhost:5180**

---

## Se connecter

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| Propriétaire (3 boutiques) | `valdes@cameleon.cm` | `Cameleon#2026` |
| Superadmin (back-office) | `support@cameleon.cm` | `Cameleon#2026` |
| PIN de caisse | — | `1234` |

Le compte propriétaire existe dans les **trois** boutiques avec le même mot de
passe : l'écran « quelle boutique ? » s'affiche donc à la connexion. C'est le
comportement voulu, pas un bug.

---

## Ce qu'il y a dans chaque boutique

| Boutique | Ventes | Chiffre d'affaires | Licence |
|---|---|---|---|
| **Bonamoussadi** | 24 | 306 000 FCFA | valide (300 jours) |
| **Bependa** | 10 | 58 200 FCFA | **échéance dans 5 jours** |
| **Logpom** | 4 | 4 700 FCFA | **expirée depuis 12 jours** |
| **TOTAL** | **38** | **368 900 FCFA** | |

Les ordres de grandeur sont volontairement très différents : si le consolidé se
trompe de boutique ou additionne mal, cela se voit sans avoir à compter.

Chacune a aussi ses produits, son stock, un fournisseur et un partenaire
grossiste — tous distincts.

---

## À essayer, dans cet ordre

**1. La connexion multi-boutique**
Connectez-vous en propriétaire. L'écran « quelle boutique ? » liste les trois.
Choisissez **Bonamoussadi**.

**2. Le sélecteur de boutique**
En haut du menu à gauche, sous le logo. Le nom de la boutique active est
affiché en permanence — pas seulement au moment de choisir.

**3. Le rapport consolidé**
Menu *Pilotage → Rapport consolidé*. Comparez au tableau ci-dessus, ligne par
ligne. C'est le seul endroit du produit qui traverse légitimement les
boutiques : les chiffres doivent correspondre exactement.

**4. Le bandeau de préavis**
Basculez sur **Bependa**. Un bandeau doit annoncer l'échéance à 5 jours et le
montant du renouvellement. Sur Bonamoussadi, rien ne doit apparaître.

**5. La lecture seule**
Basculez sur **Logpom**. Consultation, rapports et exports fonctionnent
normalement — ce sont ses données. Mais tentez de **créer un produit** ou
d'**encaisser une vente** : refus avec le montant à payer. La licence expirée
met en lecture seule, elle ne coupe jamais l'accès.

**6. Ajouter une boutique — le paiement**
Sélecteur de boutique → **« + Ajouter une boutique »**, en bas de la liste.
Remplissez le formulaire. Le numéro Mobile Money est pré-rempli et modifiable.
Le paiement est **simulé** : aucun encaissement.
Observez que **rien n'est créé tant que le paiement n'est pas confirmé** — la
page l'annonce en tête et attend.

**7. La caisse**
Menu *Changer d'espace → Caisse*, PIN `1234`. Encaissez une vente, imprimez le
ticket. Sur Logpom, l'encaissement sera refusé (licence expirée).

**8. Le back-office plateforme**
Déconnectez-vous, reconnectez-vous en **superadmin**. Vous voyez les trois
boutiques, l'état de leur licence, et pouvez prolonger.

---

## Arrêter

`Ctrl+C` dans chaque fenêtre. Les données restent dans `backend/.demo-db`.

Pour repartir de zéro : `npm run seed:demo` (il vide la base d'abord).
Pour tout supprimer : arrêtez la base et effacez `backend/.demo-db`.

---

## Si quelque chose ne va pas

**Le frontend s'affiche mais tout échoue** — le backend n'écoute pas sur 3004.
Vérifiez la fenêtre `demo:api`.

**`ECONNREFUSED 127.0.0.1:27018`** — la base n'est pas lancée (fenêtre 1).

**« Base refusée »** au lancement du seed — c'est le garde-fou. Le nom de la
base doit contenir « demo ». Il vous protège d'un effacement de base client.

**Le consolidé est vide** — il porte par défaut sur le **mois en cours**. Si
vous relancez la démonstration un 1er du mois, les ventes sont ramenées au
1er ; sinon, resemez.
