import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './api/fetchInterceptor'; // doit s'installer avant tout appel API
import './index.css';
import { migrerStockageHerite } from './services/migration-stockage';

/**
 * Démarrage.
 *
 * La migration du stockage hérité s'exécute AVANT le premier rendu : les
 * données d'avant le cloisonnement (ventes en attente comprises) doivent être
 * rattachées à leur boutique avant que quoi que ce soit ne lise le stockage.
 *
 * Si elle échoue, on n'affiche PAS l'application : un démarrage « propre »
 * laisserait des ventes réelles orphelines sous des clés que plus personne ne
 * lit, sans que personne ne s'en aperçoive. Mieux vaut un écran qui dit la
 * vérité et invite à appeler le support — les données, elles, sont toujours là.
 */
async function demarrer() {
  const racine = document.getElementById('root')!;

  try {
    await migrerStockageHerite();
  } catch (e) {
    racine.innerHTML = `
      <div style="max-width:640px;margin:12vh auto;padding:28px;font-family:Arial,Helvetica,sans-serif;
                  border:1px solid #E5E7EB;border-radius:14px;background:#fff;color:#111">
        <h1 style="font-size:20px;margin:0 0 12px;color:#B91C1C">Mise à jour du stockage interrompue</h1>
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px">
          L'application n'a pas pu réorganiser les données enregistrées sur cet appareil.
          <strong>Aucune donnée n'a été supprimée</strong> — des ventes non encore envoyées
          au serveur s'y trouvent peut-être.
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px">
          Ne videz pas le cache de ce navigateur et contactez le support avant de continuer.
        </p>
        <p style="font-size:12px;color:#6B7280;margin:0">
          Détail technique : ${String((e as Error)?.message ?? e).replace(/</g, '&lt;')}
        </p>
      </div>`;
    return;
  }

  ReactDOM.createRoot(racine).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void demarrer();
