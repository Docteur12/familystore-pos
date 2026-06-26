'use strict';

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path  = require('path');
const https = require('https');
const fs    = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────

const POS_URL        = 'https://familystore-pos.netlify.app/login';
const CHECK_HOST     = 'familystore-pos.netlify.app';
const SPLASH_MS      = 2000;   // durée minimale du splash (ms)
const NET_TIMEOUT_MS = 4000;   // timeout vérification réseau (ms)

// ── State ─────────────────────────────────────────────────────────────────────

/** @type {BrowserWindow|null} */ let mainWindow   = null;
/** @type {BrowserWindow|null} */ let splashWindow = null;
let forceQuit = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

const iconPath    = path.join(__dirname, 'assets', 'icon.ico');
const iconOptions = fs.existsSync(iconPath) ? { icon: iconPath } : {};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Vérifie que le serveur POS est joignable.
 * @returns {Promise<boolean>}
 */
function checkOnline() {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: CHECK_HOST, path: '/login', method: 'HEAD', timeout: NET_TIMEOUT_MS },
      () => { req.destroy(); resolve(true); },
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── Fenêtre splash ────────────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width:       480,
    height:      300,
    frame:       false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    center:      true,
    ...iconOptions,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
    },
  });
  splashWindow.loadFile('splash.html');
}

// ── Fenêtre principale ────────────────────────────────────────────────────────

function createMain() {
  mainWindow = new BrowserWindow({
    title:      'Family Store — Caisse',
    fullscreen: true,
    frame:      false,
    show:       false,          // reste caché jusqu'à ready-to-show
    ...iconOptions,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      nodeIntegration:  false,
      contextIsolation: true,
      // Désactiver les fonctionnalités non nécessaires en kiosque
      spellcheck:       false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Maintenir l'app dans le domaine POS
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('https://familystore-pos.netlify.app')) {
      e.preventDefault();
    }
  });

  // Autoriser les popups du domaine POS (impression de tickets)
  // Bloquer tout le reste
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://familystore-pos.netlify.app') || url === 'about:blank') {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  // Désactiver le menu contextuel (clic droit)
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Charger la page hors-ligne en cas d'échec réseau
  mainWindow.webContents.on('did-fail-load', (_e, errorCode) => {
    if (errorCode === -3) return; // ERR_ABORTED = navigation annulée volontairement
    mainWindow?.loadFile('offline.html');
  });

  // Empêcher la fermeture normale (Alt+F4, bouton OS)
  mainWindow.on('close', (e) => {
    if (!forceQuit) e.preventDefault();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC — page hors-ligne ─────────────────────────────────────────────────────

ipcMain.on('retry', async () => {
  if (!mainWindow) return;
  // Tenter de (re)charger l'app : le service worker sert le shell depuis son
  // cache si une connexion a déjà eu lieu. Sinon (aucun cache + toujours hors
  // ligne), did-fail-load ramène sur offline.html.
  mainWindow.loadURL(POS_URL);
});

// ── Cycle de vie de l'application ─────────────────────────────────────────────

app.whenReady().then(async () => {
  // 1. Afficher le splash immédiatement
  createSplash();

  // 2. Créer la fenêtre principale en arrière-plan (cachée)
  createMain();

  // 3. Vérification réseau + durée minimale du splash en parallèle
  const [online] = await Promise.all([
    checkOnline(),
    delay(SPLASH_MS),
  ]);

  // 4. Enregistrer le handler ready-to-show avant de charger l'URL
  mainWindow.once('ready-to-show', () => {
    splashWindow?.destroy();
    splashWindow = null;
    mainWindow.show();
    // Le fullscreen est déjà configuré dans les options, on s'assure juste
    mainWindow.setFullScreen(true);
  });

  // 5. Toujours tenter de charger l'app.
  //    Le service worker (PWA) sert le shell depuis son cache même hors ligne :
  //    la caisse démarre et bascule en mode hors-ligne (ventes en file, stock
  //    local). On ne tombe sur offline.html (cul-de-sac) qu'en dernier recours,
  //    via did-fail-load, si aucun cache n'existe encore (toute 1ʳᵉ ouverture
  //    avant la moindre connexion). `online` ne sert plus qu'au splash.
  void online;
  mainWindow.loadURL(POS_URL);

  // 6. Raccourci secret pour quitter le mode kiosque
  globalShortcut.register('CommandOrControl+Alt+Q', () => {
    forceQuit = true;
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit',         () => globalShortcut.unregisterAll());
