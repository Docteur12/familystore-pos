# Lot E — bascule de Family Store et Radiance

Les deux clients en production passent sur le code Caméléon.

Ce fichier est une **liste de contrôles à remplir au fur et à mesure**, pas un
document rédigé le jour J. Chaque fois qu'un lot introduit une vérification
préalable, elle s'écrit ici tout de suite — la reconstituer de mémoire au
moment de basculer, c'est exactement ainsi qu'on en oublie une.

Rappel de la règle n° 3 : répétition sur copie, vérification chiffrée,
rollback **testé**, sauvegarde fraîche prise juste avant, et fenêtre horaire
(avant 9 h ou après fermeture). Merger sur `main` **est** un déploiement.

---

## A. Contrôles AVANT bascule

### A1. `offreFacture` — le pied de ticket des deux clients

**Pourquoi.** Le défaut du schéma `Settings.offreFacture` portait le texte
« *Family Store vous offre 5 %* ». Il est désormais **vide**, pour qu'une
boutique neuve n'imprime pas une promesse commerciale au nom d'un autre.

Un défaut Mongoose ne s'applique qu'à la **création** : les documents
existants gardent leur contenu. Mais si un document `Settings` de production
ne portait pas encore ce champ, il hériterait maintenant du vide — et Family
Store perdrait le texte imprimé au bas de ses factures, sans que rien ne le
signale.

**À faire, sur `familystore` ET sur la base Radiance :**

```js
// Lecture seule, aucune écriture.
db.settings.find({}, { nomMagasin: 1, offreFacture: 1 })
```

- `offreFacture.message` non vide → rien à faire.
- Champ absent ou vide → **le restaurer depuis la sauvegarde** prise avant la
  bascule, avant de déployer. Ne pas le retaper de mémoire : le texte exact
  engage commercialement.

### A2. `nomMagasin` — obligatoire, et il ne doit pas être vide

Le défaut `'Family Store'` a été retiré (une boutique neuve en héritait). Les
documents existants ne bougent pas, mais on vérifie :

```js
db.settings.find({ $or: [{ nomMagasin: { $exists: false } }, { nomMagasin: '' }] })
```

Doit renvoyer **zéro document**. Sinon, le renseigner avant bascule : il
s'imprime en tête de chaque ticket, et le repli est désormais vide.

### A3. `manuelUrl` — le manuel de chaque boutique

Le menu pointait en dur sur `/manuel-family-store.pdf`. Radiance affichait
donc à ses employés le manuel d'un autre commerce, en français.

- Family Store : poser `manuelUrl = '/manuel-family-store.pdf'` (le fichier
  reste servi par le site) pour ne rien lui retirer.
- Radiance : laisser **vide** tant qu'il n'a pas le sien — l'entrée de menu
  disparaît, ce qui vaut mieux qu'un manuel étranger.

### A4. Variables d'environnement Netlify — identité de chaque site

Les défauts du dépôt sont passés à Caméléon. **Chaque site doit désormais
surcharger**, Family Store comme Radiance le fait déjà :

| Variable | Family Store | Radiance |
|---|---|---|
| `VITE_APP_NAME` | `Family Store POS` | `Radiance POS` |
| `VITE_APP_SHORT_NAME` | `Family Store` | `Radiance` |
| `VITE_APP_LANG` | `fr` | `en` |
| `VITE_THEME_COLOR` | `#8B1A2B` | (sa couleur) |
| `VITE_API_URL` | son backend Render | son backend Render |

⚠️ **Sans ces variables, le site déployé s'appellerait « Caméléon »** —
manifeste PWA, titre d'onglet et couleur de thème compris. À poser AVANT le
déploiement, pas après.

### A5. Paiements — clés MyCoolPay sur Render

`PAIEMENT_FOURNISSEUR` doit valoir `mycoolpay`, avec `COOLPAY_PUBLIC_KEY` et
`COOLPAY_PRIVATE_KEY` renseignées.

⚠️ **Le backend REFUSE de démarrer** si `mycoolpay` est demandé sans clé, et
le mode `simule` est interdit en production (il confirmerait les paiements
sans encaissement). Les clés partent donc en même temps que le code.

L'URL du webhook doit être déclarée dans le tableau de bord MyCoolPay.

### A6. Migrations déjà connues

- `npm run migrate:settings -- --execute` sur `familystore` (identité
  historique dans `Settings`) — voir `DEPLOY.md` §6.
- `npm run migrate:pin -- --execute` sur `familystore` **et** la base
  Radiance, AVANT le merge.

---

## B. Verrous — à lever avant un client MUTUALISÉ, pas avant cette bascule

Family Store et Radiance ont chacun leur domaine : ces trois points ne les
bloquent pas. Ils bloquent le jour où deux clients partagent une origine.

- **`GET /api/settings/public` répond 500 en mode `multi`** — sans jeton,
  aucune boutique n'est résolue. Il faudra déduire la boutique de l'origine.
  Atténué depuis que l'écran de connexion est neutre : il ne dépend plus de
  cette route pour s'afficher correctement.
- **Cache `documents-pdf` du service worker non cloisonné** — sur une origine
  partagée, une facture pourrait être servie d'une boutique à l'autre.
- **Le compte propriétaire est une clé maîtresse** — manquent le mot de passe
  fort exigé à la création et la notification e-mail au changement de mot de
  passe. 2FA à décider.

---

## C. Après bascule

- Archiver le dépôt `radiance-pos` une fois Radiance servi par ce code.
- `desktop-caisse` : `POS_URL`, `CHECK_HOST` et le titre de fenêtre sont
  encore en dur (groupe F du chantier de neutralisation).
