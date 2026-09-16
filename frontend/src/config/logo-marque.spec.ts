/**
 * Repli du logo : jamais l'enseigne d'un autre commerçant.
 *
 * Incident HERVAN (16/09/2026) : logo Family Store sur l'écran de connexion
 * d'une boutique neuve. Ce que ce test garantit :
 *  - le logo téléversé gagne toujours ;
 *  - un build de marque (VITE_BRAND_ICONS + logo.png) montre SON logo ;
 *  - un build de marque SANS logo.png ne montre rien (le nom prendra la place),
 *    surtout pas logo-fs.jpg ;
 *  - le build par défaut (Family Store, sans jeu d'icônes) garde logo-fs.jpg :
 *    Family Store n'a pas de logoUrl en base et ne doit rien perdre ;
 *  - gouvernance : le littéral logo-fs ne réapparaît pas dans les composants,
 *    et l'écran de connexion ne propose plus une adresse @familystore.cm ;
 *  - le jeu d'icônes HERVAN embarque bien un logo.png (sans quoi le repli 2
 *    n'existerait pas pour lui).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { logoAffiche } from './logo-marque';

const RACINE = resolve(__dirname, '..', '..');
const src = (chemin: string) => readFileSync(resolve(RACINE, 'src', chemin), 'utf8');

describe('logoAffiche — ordre de repli', () => {
  it('le logo téléversé gagne toujours', () => {
    expect(logoAffiche('data:image/png;base64,AAA', { VITE_LOGO_MARQUE: '/logo.png', VITE_BRAND_ICONS: 'hervan' })).toBe('data:image/png;base64,AAA');
    expect(logoAffiche('  data:image/png;base64,AAA  ', {})).toBe('data:image/png;base64,AAA');
  });

  it('build de marque avec logo.png → le logo de la marque', () => {
    expect(logoAffiche('', { VITE_LOGO_MARQUE: '/logo.png', VITE_BRAND_ICONS: 'hervan' })).toBe('/logo.png');
    expect(logoAffiche(undefined, { VITE_LOGO_MARQUE: '/logo.png', VITE_BRAND_ICONS: 'hervan' })).toBe('/logo.png');
  });

  it('build de marque SANS logo.png → rien (le nom prendra la place), jamais logo-fs', () => {
    const r = logoAffiche('', { VITE_BRAND_ICONS: 'radiance' });
    expect(r).toBe('');
  });

  it('build par défaut (sans jeu d’icônes) → logo-fs.jpg, comme avant', () => {
    const r = logoAffiche('', {});
    expect(r).toMatch(/logo-fs/);
  });
});

describe('gouvernance — le littéral logo-fs ne vit que dans config/logo-marque.ts', () => {
  for (const f of ['components/StoreLogo.tsx', 'components/AdminSidebar.tsx', 'pages/Login.tsx']) {
    it(`${f} ne référence plus logo-fs directement`, () => {
      expect(src(f)).not.toMatch(/logo-fs/);
    });
  }

  it('l’écran de connexion ne propose plus une adresse @familystore.cm', () => {
    expect(src('pages/Login.tsx')).not.toMatch(/familystore\.cm/i);
  });

  it('le jeu d’icônes HERVAN embarque un logo.png (repli de marque)', () => {
    expect(existsSync(resolve(RACINE, 'public', 'brand', 'hervan', 'logo.png'))).toBe(true);
  });
});
