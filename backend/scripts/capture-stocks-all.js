// Capture des 7 sous-pages Stock en mobile pour vérifier le responsive + le défilement.
// Usage : node scripts/capture-stocks-all.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const FRONT = 'http://localhost:5180';
const API = 'http://localhost:3004/api';
const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = CANDIDATES.find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PAGES = [
  { name: 'receptions',   path: '/stocks/receptions'  },
  { name: 'inventaire',   path: '/stocks/inventaire'  },
  { name: 'alertes',      path: '/stocks/alertes'     },
  { name: 'depots',       path: '/stocks/depots'      },
  { name: 'fournisseurs', path: '/stocks/fournisseurs'},
  { name: 'ecarts',       path: '/stocks/ecarts'      },
  { name: 'divers',       path: '/stocks/divers'      },
];

(async () => {
  if (!exe) { console.error('Aucun navigateur trouvé'); process.exit(1); }
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) });
  const data = await r.json();
  const token = data.access_token || data.token;
  if (!token) { console.error('Pas de jeton', JSON.stringify(data).slice(0, 200)); process.exit(1); }
  console.log('Jeton obtenu ✓');

  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  for (const pg of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate(t => localStorage.setItem('access_token', t), token);
    await page.goto(`${FRONT}${pg.path}`, { waitUntil: 'networkidle2' });
    await sleep(2500);
    await page.screenshot({ path: `scripts/shot-${pg.name}-haut.png` });

    // Test défilement : y a-t-il un dépassement horizontal du body ? la page défile-t-elle ?
    const info = await page.evaluate(() => {
      const main = document.querySelector('main');
      const el = main || document.scrollingElement;
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      const after = el.scrollTop;
      return {
        onMain: !!main,
        scrollH: el.scrollHeight, clientH: el.clientHeight,
        scrolled: after - before,
        // débordement horizontal de la fenêtre = mauvais (sauf tableau interne)
        docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    console.log(`${pg.name.padEnd(13)} scrollH=${info.scrollH} clientH=${info.clientH} scrolled=${info.scrolled} overflowX(doc)=${info.docOverflowX}`);
    await sleep(600);
    await page.screenshot({ path: `scripts/shot-${pg.name}-bas.png` });
    await page.close();
  }
  await browser.close();
  console.log('Terminé.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
