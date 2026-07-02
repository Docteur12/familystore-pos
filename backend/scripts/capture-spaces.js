// Diagnostic responsive mobile des espaces Admin / Partenaires / Magazinier.
// Usage : node scripts/capture-spaces.js
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

const PAGES = (process.argv[2] ? process.argv[2].split(',') : [
  'admin-dashboard:/admin/dashboard',
  'admin-caissiers:/admin/caissiers',
  'admin-rapports:/admin/rapports',
  'admin-comptabilite:/admin/comptabilite',
  'admin-parametres:/admin/parametres',
  'admin-journal:/admin/journal',
  'partenaires:/partenaires',
  'magazinier:/magazinier',
]).map(s => { const [name, path] = s.split(':'); return { name, path }; });

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
    try {
      await page.goto(`${FRONT}${pg.path}`, { waitUntil: 'networkidle2', timeout: 25000 });
    } catch { console.log(`${pg.name.padEnd(18)} NAV TIMEOUT`); await page.close(); continue; }
    await sleep(2500);
    const info = await page.evaluate(() => {
      const m = document.querySelector('main');
      let mainScroll = null;
      if (m) { const b = m.scrollTop; m.scrollTop = m.scrollHeight; mainScroll = { moved: m.scrollTop - b, sh: m.scrollHeight, ch: m.clientHeight, ovX: m.scrollWidth - m.clientWidth }; m.scrollTop = 0; }
      return {
        docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mainScroll,
      };
    });
    const ms = info.mainScroll;
    console.log(`${pg.name.padEnd(18)} docOvX=${info.docOverflowX}  main[ovX=${ms?ms.ovX:'-'} scroll=${ms?ms.moved:'-'}/${ms?ms.sh-ms.ch:'-'}]`);
    await page.screenshot({ path: `scripts/shot-${pg.name}.png` });
    await page.close();
  }
  await browser.close();
  console.log('Terminé.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
