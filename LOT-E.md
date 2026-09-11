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

### A5. Licences en mode MANUEL — pas de MyCoolPay

**Décision du 10/09/2026 : aucun paiement en ligne.** La majorité des clients
ont le numéro de Valdes ; ils règlent de la main à la main (Mobile Money,
espèces, virement) et **c'est Valdes, superadmin, qui active la licence**
depuis l'écran « Boutiques & licences » (`/admin/boutiques`). Chaque
prolongation enregistre un `Paiement` **confirmé, source `manuel`**, avec
montant, moyen, note et auteur — la trace d'un litige.

Ce que ça donne côté configuration :

- `PAIEMENT_FOURNISSEUR` **absent ou `manuel`** (c'est le défaut). Une valeur
  inconnue refuse le démarrage ; `simule` reste interdit en production.
- `CONTACT_LICENCE` : le numéro affiché aux commerçants pour renouveler
  (bandeau de préavis, refus 402, e-mails de relance). Défaut :
  `+237 6 74 63 54 11`.
- **Aucune clé MyCoolPay, aucune URL de callback à déclarer.** Le code
  MyCoolPay reste dans le dépôt, débranché : le jour où l'on voudrait le
  paiement en ligne, poser `PAIEMENT_FOURNISSEUR=mycoolpay` et ses clés, et
  reprendre l'ancienne version de cette section dans l'historique git.

Ce que voit le commerçant : le bandeau J-14/J-7/J-3/J-1 puis « expirée » avec
le numéro à appeler ; toute tentative d'ouvrir un paiement en ligne répond 400
avec le contact, sans rien écrire en base.

**Ouvrir une boutique de plus (patron existant).** La page « Ajouter une
boutique » devient un formulaire de **demande** (`POST /demandes-boutique`) :
nom, ville, futur patron (mot de passe stocké haché), téléphone, message.
Rien n'est créé. Les demandes apparaissent en tête de « Boutiques &
licences » ; Valdes encaisse, puis **« Règlement reçu → créer »**
(`POST /platform/demandes/:id/accepter`) : la boutique naît avec sa licence
d'un an, un `Paiement` confirmé objet `creation_boutique` source `manuel` est
écrit, la demande est close et son hachage effacé. Un refus porte un motif
que le patron lit dans « Mes demandes ». Une demande déjà traitée ne se
retraite pas (400).

### A6. Migrations déjà connues

- `npm run migrate:settings -- --execute` sur `familystore` (identité
  historique dans `Settings`) — voir `DEPLOY.md` §6.
- `npm run migrate:pin -- --execute` sur `familystore` **et** la base
  Radiance, AVANT le merge.

### A7. Le service Render Caméléon — sa propre base ; plan gratuit + cron acceptable

Caméléon a besoin de **son** service Render et de **sa** base, distincts de
ceux des clients. Les collections plateforme — `Proprietaire`, `Boutique`,
`Licence`, `Paiement` — sont hors cloisonnement (`skipTenant`) : elles vivent
dans la base du backend. Les poser dans `familystore` mélangerait les licences
de tous les clients aux données d'un seul.

**Plan.** Le plan payant était exigé parce que le service recevait des
webhooks de paiement et faisait tourner la réconciliation en continu — un
service endormi, c'était un client qui a payé sans être servi. **En mode
manuel (A5), il n'y a plus ni webhook ni réconciliation** : rien n'arrive de
l'extérieur sans qu'un humain soit devant l'écran. Le plan gratuit maintenu
éveillé par cron-job.org (A9) redevient acceptable ; le payant reste un
confort (pas de réveil de 30 s le matin), pas une exigence.

Ce qui reste vrai quel que soit le plan : les **relances e-mail** de licence
(J-14, J-7, J-3, J-1) tournent dans le processus. Un service qui dort la nuit
les enverra au prochain réveil — l'idempotence des seuils fait qu'aucune n'est
perdue, seulement retardée de quelques heures.

### A8. Vérifier le mode manuel APRÈS déploiement

Rien n'est encaissé en ligne, donc rien à vérifier chez un prestataire. Trois
contrôles, dans l'ordre :

1. **Journal Render au démarrage** : aucune erreur `PAIEMENT_FOURNISSEUR`
   (une valeur inconnue ou `simule` en production refuse le démarrage).
2. **`GET /api/licence/etat`** avec un jeton de boutique : la réponse porte
   `paiementEnLigne: false` et `contact` = le numéro attendu. C'est ce que lit
   le bandeau.
3. **Premier règlement réel** depuis « Boutiques & licences » : la ligne passe
   au vert, l'historique de la boutique montre le paiement `confirme`,
   `manuel`, avec l'auteur ; l'entrée « Licence prolongée jusqu'au … » figure
   dans Audit & logs.

### A9. Keep-alive cron-job.org — les URL exactes à pinger

Le plan Render gratuit met un service en veille après ~15 min d'inactivité ;
le réveil à froid prend **~30 s**. Un cron externe (cron-job.org) appelle la
route `/api/health` de chaque backend pour l'empêcher de dormir. Cette route
est taillée pour lui dans `main.ts` (2 octets, `Connection: close`) — ne pas
la modifier.

**Les URL à pinger, chacune toutes les ~10 min (sous le seuil de 15 min) :**

| Client | URL de keep-alive |
|---|---|
| **Family Store** | `https://familystore-pos.onrender.com/api/health` |
| **Radiance** | `https://familystore-pos-cd26.onrender.com/api/health` |

⚠️ **URL périmées à NE PLUS pinger** — elles ne réveillent rien :

- `https://radiance-api.onrender.com/api/health` — **ancien** service Radiance,
  suspendu. C'est vers lui que le cron pointait probablement encore : le
  27/08/2026, Radiance s'est réveillée lentement et son écran de connexion a
  affiché Family Store pendant ~30 s, symptôme exact d'un service **non**
  maintenu éveillé. La production Radiance est passée à `cd26` ; le cron doit
  suivre.
- `https://familystore-api.onrender.com/…` — nom d'un service qui n'existe
  pas (répond 404 instantané). Le vrai Family Store est `familystore-pos`.

Source de vérité, si un doute subsiste sur l'URL réelle d'un client : ouvrir
son site Netlify, regarder quelle adresse `onrender.com` son bundle appelle
(`VITE_API_BASE`), ou vers quoi mène le proxy `/api` de `netlify.toml`.

**Le service Caméléon** peut lui aussi vivre en gratuit + cron depuis le
passage en mode manuel (A5, A7) : plus de webhook à recevoir ni de
réconciliation à faire tourner. Ajouter son URL `/api/health` à la même liste
dès qu'il existe.

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
`main`, racine `backend`, **plan gratuit + cron-job.org, ou Starter — voir
A7**, région Frankfurt. Build `npm install --include=dev --ignore-scripts && npm run build`,
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
| `PAIEMENT_FOURNISSEUR` | `manuel` (ou absent — voir A5 ; **jamais** `simule`) |
| `CONTACT_LICENCE` | `+237 6 74 63 54 11` — le numéro que les commerçants appellent |
| `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_ALERT_TO` | *(comme les autres services)* |

**Netlify — site Caméléon** : aucune surcharge d'identité (les défauts du
dépôt SONT Caméléon), seulement `VITE_API_BASE=https://<service-cameleon>.onrender.com`.

**Premier superadmin** — le compte de Valdes, sans lequel aucune boutique ne
s'ouvre et aucune licence ne s'active. Depuis `backend/`, `.env` pointant sur
la base Caméléon (`MONGO_URI=…/cameleon`) :

```bash
npm run creer:superadmin -- --base=cameleon --email=<e-mail> --nom="Valdes" --mdp=<12 caractères min, Aa1>
npm run creer:superadmin -- --base=cameleon --email=<e-mail> --nom="Valdes" --mdp=... --execute
```

Dry-run d'abord (défaut), puis `--execute`. Le script refuse les bases
`familystore` et `radiance`, un mot de passe faible, et ne crée jamais de
doublon. Le compte vit dans un tenant technique qui n'est la boutique de
personne ; à la connexion, l'accueil mène à « Boutiques & licences ».

## C. Après bascule

- Archiver le dépôt `radiance-pos` une fois Radiance servi par ce code.
- `desktop-caisse` : `POS_URL`, `CHECK_HOST` et le titre de fenêtre sont
  encore en dur (groupe F du chantier de neutralisation).
