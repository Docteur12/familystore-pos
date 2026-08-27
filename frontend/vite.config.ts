// @node_modules\fork-ts-checker-webpack-plugin\
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';



// ── Marque au moment du build ─────────────────────────────────────────────────
// Un seul dépôt sert plusieurs magasins (Family Store, Radiance…). Tout ce qui
// se lit en base passe par les Paramètres ; ce qui doit être figé dans le
// bundle (titre de l'onglet, manifeste PWA, langue du document, couleur de
// thème, URL de l'API) est piloté par des variables VITE_* — définies dans
// .env.production pour Family Store, surchargées site par site sur Netlify.
function brandFromEnv(mode: string) {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  return {
    name:       env.VITE_APP_NAME       || 'Caméléon',
    shortName:  env.VITE_APP_SHORT_NAME || 'Caméléon',
    lang:       env.VITE_APP_LANG       || 'fr',
    themeColor: env.VITE_THEME_COLOR    || '#3F8F6B',
    bgColor:    env.VITE_BG_COLOR       || '#F5F0E8',
    icons:      env.VITE_BRAND_ICONS    || '',   // jeu d'icônes de public/brand/<nom>
  };
}
type Brand = ReturnType<typeof brandFromEnv>;

// Vite remplace lui-même %VITE_*% dans index.html à partir de import.meta.env :
// on y expose les valeurs résolues (défauts compris) pour qu'aucun jeton ne
// reste vide quand la variable n'est pas définie.
function exposeBrand(b: Brand) {
  process.env.VITE_APP_NAME    = b.name;
  process.env.VITE_APP_LANG    = b.lang;
  process.env.VITE_THEME_COLOR = b.themeColor;
}

// index.html : remplace %VITE_APP_NAME%, %VITE_APP_LANG%, %VITE_THEME_COLOR%.
function htmlBrand(b: Brand): Plugin {
  return {
    name: 'html-brand',
    transformIndexHtml(html) {
      return html
        .replace(/%VITE_APP_NAME%/g, b.name)
        .replace(/%VITE_APP_LANG%/g, b.lang)
        .replace(/%VITE_THEME_COLOR%/g, b.themeColor);
    },
  };
}

// Icônes par magasin.
//
// Les favicons de `public/` sont désormais ceux de CAMÉLÉON — ils portaient
// l'identité de Family Store, si bien qu'un site déployé sans surcharge
// installait une application à l'icône d'un autre commerçant, jusque sur
// l'écran d'accueil du téléphone.
//
// Chaque client pose les siens : `VITE_BRAND_ICONS=<nom>` sur son site
// Netlify, et les fichiers de `public/brand/<nom>/` écrasent ceux de la
// racine de `dist` à la fin du build — favicon de l'onglet, icône PWA,
// apple-touch-icon. `family-store` et `radiance` existent tous deux.
function brandIcons(b: Brand): Plugin {
  return {
    name: 'brand-icons',
    apply: 'build',
    closeBundle() {
      if (!b.icons) return;
      const src = resolve(process.cwd(), 'public', 'brand', b.icons);
      const out = resolve(process.cwd(), 'dist');
      if (!existsSync(src)) throw new Error(`VITE_BRAND_ICONS=${b.icons} : dossier absent — ${src}`);
      for (const f of readdirSync(src)) copyFileSync(resolve(src, f), resolve(out, f));
    },
  };
}

// ⚠️ Ne PAS générer de dist/_redirects : un fichier _redirects prime sur
// netlify.toml, et le proxy /api qui y était généré transmettait à Render
// l'hôte d'origine (…netlify.app) → « X-Render-Routing: no-server », API
// morte en production (incident du 21/08/2026). Le proxy /api et le fallback
// SPA vivent dans frontend/netlify.toml.

export default defineConfig(({ mode }) => {
  const brand = brandFromEnv(mode);
  return {
  plugins: [
    react(),
    htmlBrand(brand),
    brandIcons(brand),

    VitePWA({
      // Mise à jour appliquée au PROCHAIN démarrage, jamais en pleine vente.
      // ⚠️ NE PAS mettre 'autoUpdate' : ce mode force self.skipWaiting() dans le
      // SW et recharge la page dès qu'une nouvelle version est déployée (panier
      // perdu). En mode 'prompt', le nouveau SW reste en attente tant que l'app
      // est ouverte et s'active au lancement suivant. Aucune UI de prompt n'est
      // branchée → comportement = « update silencieux au prochain démarrage ».
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: brand.name,
        short_name: brand.shortName,
        description: `Caisse ${brand.shortName}`,
        lang: brand.lang,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: brand.bgColor,
        theme_color: brand.themeColor,
        // 192 et 512 sont les tailles qu'Android réclame à l'installation ;
        // sans elles, le système agrandissait le favicon 32×32 — icône floue
        // sur l'écran d'accueil. `maskable` évite qu'Android rogne le « C »
        // en appliquant sa propre forme par-dessus.
        icons: [
          { src: '/favicon-32x32.png',    sizes: '32x32',   type: 'image/png' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: '/pwa-192x192.png',      sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png',      sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png',      sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Précache du shell applicatif (JS / CSS / HTML / icônes) → l'app
        // démarre et fonctionne même sans connexion après une 1ʳᵉ visite.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Le bundle principal dépasse 2 Mio ; sans cette limite relevée il ne
        // serait PAS précaché → l'app ne démarrerait pas hors-ligne.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Toute navigation hors-ligne retombe sur l'app (SPA)…
        navigateFallback: '/index.html',
        // …SAUF les appels API (toujours réseau) et les FICHIERS (.pdf…) :
        // sans cette exclusion, le service worker renvoyait index.html à la
        // place du manuel PDF → page blanche chez le client.
        navigateFallbackDenylist: [/^\/api\//, /\.pdf$/i],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // Manuel PDF : réseau d'abord, copie en cache → consultable même hors connexion
            urlPattern: /\.pdf$/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'documents-pdf' },
          },
        ],
        // clientsClaim : le SW prend le contrôle dès la 1ʳᵉ visite (offline
        // opérationnel sans rechargement manuel).
        clientsClaim: true,
        // skipWaiting VOLONTAIREMENT absent : une nouvelle version ne recharge
        // JAMAIS la page en cours (panier protégé) ; elle s'applique au prochain
        // lancement de la caisse.
        skipWaiting: false,
      },
    }),
  ],
  server: {
    port: 5180,
    strictPort: true, // toujours ce port dédié → plus de conflit/décalage avec les autres projets
    proxy: {
      '/api': 'http://localhost:3004',
    },
  },
  };
});
