// @node_modules\fork-ts-checker-webpack-plugin\
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
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
        name: 'Family Store POS',
        short_name: 'Family Store',
        description: 'Caisse Family Store',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#F5F0E8',
        theme_color: '#8B1A2B',
        icons: [
          { src: '/favicon-32x32.png',   sizes: '32x32',   type: 'image/png' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
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
        // …SAUF les appels API, qui doivent toujours partir vers le réseau
        // (le proxy Netlify les route vers le backend). La caisse gère
        // elle-même le hors-ligne via IndexedDB ; on ne met JAMAIS l'API en cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
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
});
