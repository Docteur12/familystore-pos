// Capture de /stocks (Catalogue produits) en mobile + tablette pour vérifier le responsive.
// Usage : node scripts/capture-stocks-mobile.js
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

const VIEWS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablette', width: 768, height: 1024 },
];

(async () => {
  if (!exe) { console.error('Aucun navigateur trouvé'); process.exit(1); }

  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) });
  const data = await r.json();
  const token = data.access_token || data.token || data.accessToken || data.jwt;
  if (!token) { console.error('Pas de jeton. Réponse:', JSON.stringify(data).slice(0, 300)); process.exit(1); }
  console.log('Jeton obtenu ✓');

  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  for (const v of VIEWS) {
    const page = await browser.newPage();
    await page.setViewport({ width: v.width, height: v.height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate(t => localStorage.setItem('access_token', t), token);
    await page.goto(`${FRONT}/stocks`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => /Catalogue produits/i.test(document.body.innerText), { timeout: 12000 }).catch(() => {});
    await sleep(2500);
    await page.screenshot({ path: `scripts/shot-stocks-${v.name}.png` });
    console.log(`Capture ${v.name} (${v.width}×${v.height}) ✓`);

    // Test du défilement : on fait défiler <main> jusqu'en bas
    const scrolled = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { ok: false };
      const before = main.scrollTop;
      main.scrollTop = main.scrollHeight;
      return { ok: true, before, after: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
    });
    console.log(`  scroll ${v.name}:`, JSON.stringify(scrolled));
    await sleep(800);
    await page.screenshot({ path: `scripts/shot-stocks-${v.name}-bas.png` });
    console.log(`Capture ${v.name} (bas de page) ✓`);
    await page.close();
  }

  await browser.close();
  console.log('Terminé.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
