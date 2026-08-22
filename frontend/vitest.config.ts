/**
 * Tests du frontend — introduits par le lot A de Caméléon.
 *
 * Configuration séparée de `vite.config.ts` : celui-ci charge le plugin PWA et
 * la marque au build, inutiles (et bruyants) sous test.
 *
 * `environment: 'jsdom'` fournit localStorage/sessionStorage ; le fichier de
 * mise en place ajoute une IndexedDB en mémoire.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    restoreMocks: true,
  },
});
