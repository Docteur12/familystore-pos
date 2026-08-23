# outils/

Les scripts d'installation d'un poste de caisse ont déménagé dans
[`frontend/public/outils/`](../frontend/public/outils/).

Ils y sont **servis par l'application** : chaque boutique les télécharge
elle-même depuis la page « Installer un poste de caisse », sans qu'on ait à
les lui envoyer. Un seul exemplaire dans le dépôt, donc pas de copie qui
diverge de celle que les clients utilisent.

| Fichier | Rôle |
|---|---|
| `installer-imprimante-ticket.ps1` | crée la file d'impression sur le bon port Epson, la répare si elle vise le mauvais, puis enchaîne sur le tiroir |
| `tiroir-caisse.ps1` | pose la tâche Windows qui ouvre le tiroir à chaque ticket |
| `LISEZ-MOI.txt` | mode d'emploi joint au téléchargement |

La page qui les présente : `frontend/src/pages/AdminPosteCaisse.tsx`.
