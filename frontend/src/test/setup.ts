/**
 * Mise en place commune des tests frontend.
 *
 * jsdom fournit localStorage et sessionStorage mais PAS IndexedDB, dont
 * dépend `idb-keyval` (files hors-ligne). `fake-indexeddb/auto` installe une
 * implémentation en mémoire, conforme à la spécification : les tests
 * traversent donc la vraie pile de stockage, pas un mock maison — même
 * principe que la base MongoDB en mémoire côté backend.
 */
import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { clear as viderIndexedDb } from 'idb-keyval';

// État neuf entre deux tests.
//
// ⚠️ IndexedDB doit être vidée AUSSI : contrairement à localStorage, elle
// survit d'un test à l'autre dans le même fichier. Sans cette remise à zéro,
// les files s'empilent d'un scénario au suivant et les assertions de longueur
// deviennent fausses — on l'a constaté en écrivant les tests de migration.
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  await viderIndexedDb();
});
