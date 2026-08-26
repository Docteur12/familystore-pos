# Retour d'un article en magasin — Guide du gestionnaire de stock

*Family Store POS · août 2026*

---

## L'essentiel en trois phrases

1. **Le retour est enregistré par l'administrateur**, depuis le *Journal des ventes*, en corrigeant le ticket d'origine.
2. **Le stock se met à jour tout seul** : l'article rendu revient en stock caisse, l'article donné en échange en sort.
3. **Vous n'avez rien à saisir.** Surtout pas d'entrée manuelle : l'article serait compté deux fois.

---

## Où ça se passe

Côté administrateur : **Administration › Pilotage › Journal des ventes**.

L'administrateur retrouve le ticket grâce au **numéro imprimé en bas du ticket papier** (`#XXXXXX`), ou par la date, l'heure et la caissière.

Chaque ligne du journal porte trois boutons :

| Bouton | Action |
|---|---|
| Imprimante | Réimprimer le ticket |
| Crayon | **Corriger la vente** — c'est le retour |
| Corbeille | Supprimer la vente entière |

---

## Comment l'administrateur corrige le ticket

1. Clic sur le **crayon** → fenêtre « Corriger la vente #XXXXXX ».
2. **Article rendu** : baisser la quantité, ou retirer la ligne avec le **×**.
3. **Échange** : champ « + Ajouter un article » → choisir le produit de remplacement (le stock disponible s'affiche à côté).
4. Vérifier la ligne du bas : **« À rembourser au client »** ou **« Complément à encaisser »**.
5. Saisir le **motif** (obligatoire, 5 caractères minimum). Exemple : « Client a rendu 1 savon ».
6. **« Enregistrer la correction »**. Le ticket corrigé s'imprime avec la mention **TICKET CORRIGÉ** (case à décocher si l'impression n'est pas voulue).

Après coup, le ticket porte le badge **CORRIGÉE** dans le journal, et son historique (avant / après, motif, auteur, date) s'affiche en dépliant la ligne.

---

## Ce que ça fait dans votre stock

| Situation | Stock caisse | Mouvement enregistré |
|---|---|---|
| Article rendu (quantité baissée ou ligne retirée) | **+ quantité rendue** | Entrée (+), motif `modification_vente` |
| Article donné en échange | **− quantité donnée** | Sortie (−), motif `modification_vente` |
| Prix corrigé seulement | aucun changement | aucun |
| Ticket supprimé (corbeille) | **+ tout le ticket** | Entrée (+), motif `annulation_vente` |

Deux précisions :

- La quantité remise est **exactement** la quantité rendue. Si le client avait pris 3 savons et en rend 2, le stock fait **+2**, pas +3.
- Seul le **stock caisse** bouge. Le stock entrepôt n'est jamais touché par un retour.

---

## Où vous le voyez

**Stocks › Catalogue produits › ouvrir la fiche du produit › panneau « Mouvements récents »** (les six derniers).

Une ligne de retour ressemble à :

```
+2   modification_vente   22 août
```

Le motif saisi par l'administrateur n'apparaît **pas** dans ce panneau. Pour le lire, il faut le *Journal des ventes* (ticket déplié) ou le journal d'audit de l'administration.

---

## Règles et limites

- **Pas de retour après 30 jours.** L'application le refuse. Voir avec le patron.
- **Article rendu abîmé ou invendable** : la correction le remet en stock **vendable**. Signalez-le au patron pour qu'il le sorte du stock.
- **Seul l'administrateur** peut corriger ou supprimer un ticket. Un caissier ou un gestionnaire qui reçoit un retour remet le client et son ticket à l'administrateur.
- **Jamais d'entrée manuelle** pour un retour. Le stock serait doublé.

---

## Cas fréquents

| Le client… | L'administrateur… | Effet sur le stock |
|---|---|---|
| rend 1 article et veut son argent | baisse la quantité → « À rembourser » | + 1 |
| échange contre un autre produit | retire l'un, ajoute l'autre | + 1 et − 1 |
| signale que la caissière a tapé 3 au lieu de 1 | corrige la quantité | + 2 |
| revient avec un ticket saisi deux fois | corbeille, avec motif | tout le ticket revient |
| revient avec un ticket de plus de 30 jours | ne peut rien faire dans l'application | aucun — voir le patron |
