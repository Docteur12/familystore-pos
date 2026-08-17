# Générateurs de documents client

Scripts Python qui produisent les documents Word remis au client, mise en forme
comprise (bannière bordeaux, logo, tableaux, pied de page paginé), puis les
exportent en PDF.

Récupérés de l'ancien poste, où ils n'étaient pas versionnés. Le **texte des
documents est écrit dans le script lui-même** : il n'y a pas de source Markdown
séparée, modifier le document veut dire modifier le `.py`.

## Ce que chaque script produit

| Script | Produit à la racine du dépôt |
|---|---|
| `gen_recap_docx.py` | `RECAP_GROSSE_MISE_A_JOUR.docx` + `.pdf` |
| `gen_reponse_protocole.py` | `REPONSE_PROTOCOLE_TESTS_V6.docx` + `.pdf` |

## ⚠️ Les manuels utilisateur ne sont PAS régénérables par ces scripts

`MANUEL_FAMILY_STORE_COMPLET.docx` / `.pdf` et leur version `_v2` n'ont **aucun
générateur**. Ils ont été rédigés directement dans Word. Ces fichiers sont donc
irremplaçables : ils doivent être archivés hors du dépôt, pas reconstruits.

## Avant la première exécution

Chaque script contient en tête un chemin absolu hérité de l'ancien poste :

```python
ROOT = r'c:\Users\Jorda\familystore-pos'
```

**À adapter** à l'emplacement du dépôt sur votre machine, sinon le script écrit
ailleurs — ou échoue à trouver le logo. Les scripts sont laissés tels qu'ils ont
été récupérés ; à terme, remplacer cette ligne par un chemin relatif calculé
depuis `__file__` éviterait la manipulation.

Chaque script lit aussi un logo, dont le chemin dépend de `ROOT` :

- `gen_recap_docx.py` → `frontend/public/apple-touch-icon.png`
- `gen_reponse_protocole.py` → `frontend/src/assets/logo-fs.jpg`

Si le fichier est absent, la bannière est produite sans logo (pas d'erreur).

## Dépendances

```bash
pip install python-docx docx2pdf pywin32
```

- `python-docx` — construction du `.docx` (les deux scripts)
- `docx2pdf` — export PDF de `gen_recap_docx.py`
- `pywin32` — export PDF de `gen_reponse_protocole.py`, qui pilote Word en COM

**Windows et Microsoft Word sont requis pour l'export PDF.** Sans eux, le
`.docx` est tout de même produit : l'échec de la conversion est intercepté et
affiche `PDF non genere: ...`.

`gen_reponse_protocole.py` force `word.ActivePrinter = 'Microsoft Print to PDF'`
avant l'export. Ce n'est pas cosmétique : avec une imprimante par défaut du type
« Generic / Text Only », Word calcule de mauvaises largeurs de caractères et le
PDF sort avec des espaces parasites.

## Exécution

```bash
python docs/generateurs/gen_recap_docx.py
python docs/generateurs/gen_reponse_protocole.py
```

Les fichiers sont écrits à la racine de `ROOT`, pas dans ce dossier.
