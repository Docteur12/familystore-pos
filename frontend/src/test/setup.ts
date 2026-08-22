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

// État neuf entre deux tests : sans cela, une boutique active laissée par un
// test précédent masquerait une régression du fail-closed.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
