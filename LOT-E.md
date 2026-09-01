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

**✅ Résultat du pré-vol (27/08/2026, sur copies fraîches) :**

- **Family Store** : présent, 170 caractères (« Bénéficiez de *5 % de
  réduction* sur tout achat… »). Rien à faire.
- **Radiance** : **absent** — et décision prise : **ne rien restaurer.**
  Radiance n'a jamais eu de texte à elle ; ce que ses tickets impriment
  aujourd'hui, c'est le défaut du frontend en production — « *Family Store
  vous offre 5 %* », en français, sur les reçus d'une boutique anglophone. Un
  défaut subi, pas un réglage choisi. La bascule le fait disparaître : le
  nouveau défaut est vide. Si Radiance veut un pied de ticket, elle le saisit
  elle-même, en anglais, dans ses Paramètres.

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
| `VITE_API_BASE` | *(vide — proxy `netlify.toml`)* | `https://familystore-pos-cd26.onrender.com` |
| `VITE_BRAND_ICONS` | `family-store` | `radiance` |

⚠️ **Sans ces variables, le site déployé s'appellerait « Caméléon »** —
manifeste PWA, titre d'onglet et couleur de thème compris. À poser AVANT le
déploiement, pas après.

⚠️ **`VITE_API_BASE`, pas `VITE_API_URL`.** Ce tableau documentait
`VITE_API_URL` — une variable que **rien ne lit** (le code lit `VITE_API_BASE`,
dans `api/fetchInterceptor.ts`). Elle vivait aussi dans `.env.production` et
`vite.config.ts`, calculée puis jamais employée. Retirée le 27/08/2026 : un
site configuré en s'y fiant aurait interrogé le mauvais backend, sans erreur.
Pour Family Store, la laisser **vide** — c'est le proxy de `netlify.toml` qui
route vers son backend.

⚠️ **`VITE_BRAND_ICONS` est NOUVELLE pour Family Store.** Ses icônes étaient
celles de `public/`, c'est-à-dire le défaut du dépôt ; elles ont déménagé dans
`public/brand/family-store/` et le défaut est passé à Caméléon. Sans cette
variable, Family Store se déploierait avec l'icône Caméléon — onglet du
navigateur ET icône installée sur les téléphones. Radiance, lui, la déclare
déjà.

### A5. Paiements — clés MyCoolPay sur Render

`PAIEMENT_FOURNISSEUR` doit valoir `mycoolpay`, avec `COOLPAY_PUBLIC_KEY` et
`COOLPAY_PRIVATE_KEY` renseignées.

⚠️ **Le backend REFUSE de démarrer** si `mycoolpay` est demandé sans clé, et
le mode `simule` est interdit en production (il confirmerait les paiements
sans encaissement). Les clés partent donc en même temps que le code.

**URL de callback à déclarer dans le tableau de bord MyCoolPay :**

```
https://<service-render-cameleon>/api/paiements/webhook
```

Ce chemin n'est pas arbitraire : c'est aussi celui sur lequel `main.ts` capte
le **corps brut** de la requête. Le changer sans changer les deux romprait la
lecture de la référence.

Les URL de succès / annulation / erreur pointent sur `/paiement/retour`. Elles
ne créditent rien et ne doivent jamais le faire : le navigateur du payeur y
arrive parce qu'on l'y a envoyé, ce que n'importe qui peut reproduire en
tapant l'adresse.

### A6. Migrations déjà connues

- `npm run migrate:settings -- --execute` sur `familystore` (identité
  historique dans `Settings`) — voir `DEPLOY.md` §6.
- `npm run migrate:pin -- --execute` sur `familystore` **et** la base
  Radiance, AVANT le merge.

### A7. Le service Render Caméléon — plan PAYANT, et sa propre base

Caméléon a besoin de **son** service Render et de **sa** base, distincts de
ceux des clients. Les collections plateforme — `Proprietaire`, `Boutique`,
`Licence`, `Paiement` — sont hors cloisonnement (`skipTenant`) : elles vivent
dans la base du backend. Les poser dans `familystore` mélangerait les licences
de tous les clients aux données d'un seul.

⚠️ **Plan payant, pas le plan gratuit.** Ce n'est pas un confort technique.
C'est ce service qui reçoit les webhooks de paiement, et le plan gratuit met
l'instance en veille après inactivité :

- un webhook réveillant un service endormi attend 30 à 60 s, parfois échoue ;
- MyCoolPay rejoue alors en rafale — 202 requêtes pour 2 paiements ont été
  observées chez Tontina Market — ce qui aggrave l'encombrement ;
- surtout, **la réconciliation active ne tourne pas pendant la veille**. C'est
  elle qui rattrape les webhooks perdus. Un service endormi, c'est un client
  qui a payé et dont la boutique n'existe pas tant que personne n'ouvre
  l'application.

Le risque est donc commercial : encaisser sans rendre le service. La
conception le prévoit (500 pour forcer le rejeu, suivi 24 h après expiration),
mais aucune de ces défenses ne fonctionne si le processus dort.

### A8. Vérifier le webhook APRÈS déploiement, par un vrai paiement

MyCoolPay n'a **pas d'environnement d'essai** : aucun test automatique ne peut
prouver que la route est atteinte. La seule vérification possible est un
paiement réel, une fois le service en ligne.

À contrôler dans le journal du service, sur ce paiement :

1. une requête arrive sur `/api/paiements/webhook` ;
2. elle déclenche un appel `checkStatus` sortant — le webhook n'est cru sur
   rien, il ne fait que déclencher la vérification ;
3. le paiement passe à `confirme` et la boutique est créée **une seule fois**.

Si aucune requête n'arrive : vérifier l'URL déclarée chez MyCoolPay. La
boutique se créera quand même, par la réconciliation active — plus lentement.
C'est le filet, pas le fonctionnement normal.

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

## D. Préparation — tout ce qui se fait AVANT le jour J

Écrit le 27/08/2026. Objectif : le jour J, il ne reste que la bascule
elle-même — une heure, pas une journée.

### D0. Ce que la bascule est, et n'est pas

**La bascule = merger `integration/cameleon` dans `main`.** Les deux services
Render (Family Store, Radiance `cd26`) et les deux sites Netlify se
reconstruisent depuis `main` : un seul merge déploie les deux clients.

Les deux clients **restent en `TENANT_MODE=single`, chacun sur sa base**. Le
code Caméléon fonctionne en single : le module plateforme est inerte (pas de
licence connue = pas de blocage), le prestataire de paiement ne lève qu'à
l'usage — **aucune clé MyCoolPay n'est nécessaire** pour ces deux services.

**Aucune migration de données** n'est requise : tous les champs nouveaux ont
un défaut, les anciens documents se lisent tels quels. Le pré-vol (D1) vérifie
que les migrations DÉJÀ exigées par la production actuelle (tenant, identité,
PIN haché) sont bien passées.

**Le service Caméléon (A7) n'est PAS un prérequis de la bascule.** C'est le
lancement SaaS — nouveaux clients, paiements, superadmin. Il se prépare en
parallèle (D5) et se met en service à sa propre date.

### D1. Le pré-vol chiffré — `npm run verifier:lot-e`

Lecture seule. Vise la base de `MONGO_URI`. Rend `BLOQUANT` / `À DÉCIDER` /
`OK` / `INFO`, et sort en erreur s'il reste un point bloquant. Couvre A1, A2,
A3, le PIN haché et purgé, les e-mails d'employés, le cloisonnement et ses
index composites.

À lancer **sur la copie** pour la répétition, **sur la production** le jour J.

### D2. La répétition sur copie — ce qu'il faut demander à Valdes

Le cycle de la règle n° 3 exige une copie FRAÎCHE de chaque base, faite avec
`copy-db.js` (il recrée les index partiels ; `mongodump` ne suffit pas). Sur
le cluster de production (`fjo84gc`), avec `MONGO_URI` visant ce cluster :

```
node scripts/copy-db.js familystore familystore_lotE
node scripts/copy-db.js radiance    radiance_lotE
```

Puis communiquer une URI en lecture vers ces deux copies. La répétition
consiste alors à : lancer `verifier:lot-e` sur chacune, démarrer le backend
`integration/cameleon` dessus (`TENANT_MODE=single`), et rejouer les
vérifications de D4 — connexion, `settings/public`, ticket, journal.

### D3. Ce que Valdes saisit — valeurs exactes

**Netlify — site Family Store** (`familystore-pos.netlify.app`) :

| Variable | Valeur |
|---|---|
| `VITE_APP_NAME` | `Family Store POS` |
| `VITE_APP_SHORT_NAME` | `Family Store` |
| `VITE_APP_LANG` | `fr` |
| `VITE_THEME_COLOR` | `#8B1A2B` |
| `VITE_BG_COLOR` | `#F5F0E8` |
| `VITE_API_BASE` | *(ne pas définir — proxy `netlify.toml`)* |
| `VITE_BRAND_ICONS` | `family-store` ← **NOUVELLE, obligatoire** |

**Netlify — site Radiance** (`radiance-pos.netlify.app`) — à VÉRIFIER, elles
existent déjà :

| Variable | Valeur |
|---|---|
| `VITE_APP_NAME` | `Radiance POS` |
| `VITE_APP_SHORT_NAME` | `Radiance` |
| `VITE_APP_LANG` | `en` |
| `VITE_THEME_COLOR` | `#221C1A` |
| `VITE_BG_COLOR` | `#FCF8EA` |
| `VITE_API_BASE` | `https://familystore-pos-cd26.onrender.com` |
| `VITE_BRAND_ICONS` | `radiance` |

**Render — service Family Store** (`familystore-pos.onrender.com`), à vérifier :

| Variable | Valeur |
|---|---|
| `TENANT_MODE` | `single` |
| `APP_NAME` | `Family Store POS` |
| `JWT_EXPIRES_IN` | `24h` |
| `MONGO_URI` | `…fjo84gc…/familystore` — **vérifier le nom de base** |
| `CORS_ORIGINS` | *(défaut : les deux sites Netlify — ne rien mettre)* |

**Render — service Radiance** (`familystore-pos-cd26.onrender.com`), à vérifier :
`TENANT_MODE=single`, `APP_NAME=Radiance POS`, `JWT_EXPIRES_IN=24h`,
`MONGO_URI` → `…fjo84gc…/radiance`, et confirmer que le service déploie
depuis `main` de `Docteur12/familystore-pos`.

### D4. Le jour J — une heure, dans la fenêtre (avant 9 h ou après fermeture)

| Quand | Quoi | Qui |
|---|---|---|
| T−20 | **Sauvegarde fraîche** : `copy-db.js familystore familystore_sauv_JJMMAAAA`, idem `radiance` | Valdes |
| T−15 | `verifier:lot-e` sur `familystore` puis `radiance` (lecture seule) — **zéro BLOQUANT** | Claude |
| T−10 | Variables Netlify et Render (D3) confirmées dans les tableaux de bord | Valdes |
| T−5 | Noter le commit de `main` courant = **cible de retour arrière** | Claude |
| **T0** | **Merge `integration/cameleon` → `main`** — c'est le déploiement | Valdes |
| T+5 | `/api/health` et `/api/settings/public` des DEUX services : nom, langue, couleur | Claude |
| T+8 | Les deux sites : `<title>`, `lang`, favicon, manifeste — identité de chaque client | Claude |
| T+12 | Connexion patron sur chaque client ; ticket de test imprimé (nom en tête) ; journal des ventes | Valdes |
| T+20 → T+60 | Journaux Render des deux services, aucune erreur 5xx | Claude |

**Retour arrière — testé le jour même, sur la copie, avant T0** : aucune
migration de données à défaire. Render → *Rollback to previous deploy*,
Netlify → *Publish* du déploiement précédent : instantané des deux côtés.
Les champs que le nouveau code aura écrits entre-temps (`sale.modifications`,
`settings.manuelUrl`) sont **ignorés par l'ancien code**, pas détruits.

### D5. Le service Caméléon — en parallèle, pas un prérequis

**Render** → New Web Service → dépôt `Docteur12/familystore-pos`, branche
`main`, racine `backend`, **plan Starter (payant — voir A7)**, région
Frankfurt. Build `npm install --include=dev --ignore-scripts && npm run build`,
start `node dist/main.js`.

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `TZ` | `Africa/Douala` |
| `TENANT_MODE` | `multi` |
| `APP_NAME` | `Caméléon` |
| `MONGO_URI` | `…fjo84gc…/cameleon` — **base neuve, distincte** |
| `JWT_SECRET` | **nouveau secret, distinct des clients** |
| `JWT_EXPIRES_IN` | `24h` |
| `CORS_ORIGINS` | `https://<site-cameleon>.netlify.app` |
| `PAIEMENT_FOURNISSEUR` | `mycoolpay` |
| `COOLPAY_PUBLIC_KEY` | *(tableau de bord MyCoolPay, application Caméléon)* |
| `COOLPAY_PRIVATE_KEY` | *(idem — diagnostic seulement, ne bloque rien)* |
| `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_ALERT_TO` | *(comme les autres services)* |

**Netlify — site Caméléon** : aucune surcharge d'identité (les défauts du
dépôt SONT Caméléon), seulement `VITE_API_BASE=https://<service-cameleon>.onrender.com`.

**MyCoolPay — application Caméléon**, une fois le service créé :

| Champ | Valeur |
|---|---|
| URL de callback | `https://<service-cameleon>.onrender.com/api/paiements/webhook` |
| URL de succès / annulation / erreur | `https://<site-cameleon>.netlify.app/paiement/retour` |

**Manque encore** : un script pour créer le **premier superadmin** en
production (`seed-demo` le fait pour la démonstration, rien ne le fait pour
une base neuve). À écrire avant la mise en service Caméléon.

## C. Après bascule

- Archiver le dépôt `radiance-pos` une fois Radiance servi par ce code.
- `desktop-caisse` : `POS_URL`, `CHECK_HOST` et le titre de fenêtre sont
  encore en dur (groupe F du chantier de neutralisation).
