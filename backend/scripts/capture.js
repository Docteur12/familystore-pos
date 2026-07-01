// Capture d'écran de l'espace Partenaires (détail Santa Lucia) via le navigateur du système.
// Usage : node scripts/capture.js
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

(async () => {
  if (!exe) { console.error('Aucun navigateur trouvé'); process.exit(1); }

  // 1) jeton via l'API
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) });
  const data = await r.json();
  const token = data.access_token || data.token || data.accessToken || data.jwt;
  if (!token) { console.error('Pas de jeton. Réponse:', JSON.stringify(data).slice(0, 300)); process.exit(1); }
  console.log('Jeton obtenu ✓');

  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1366, height: 820 } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  [page error]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  [console error]', m.text().slice(0, 200)); });
  page.on('requestfailed', r => console.log('  [request failed]', r.url(), r.failure() && r.failure().errorText));

  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('access_token', t), token);
  await page.goto(`${FRONT}/partenaires`, { waitUntil: 'networkidle2' });
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'scripts/shot-1-liste.png' });
  console.log('Capture 1 (liste) ✓');

  // clic sur Santa Lucia
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find(x => /santa\s*lucia/i.test(x.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('clic Santa Lucia:', clicked);

  // attendre que le détail (agences / dette) s'affiche
  let loaded = false;
  try {
    await page.waitForFunction(() => /Agences indépendantes|Dette commune|Total livré/.test(document.body.innerText), { timeout: 10000 });
    loaded = true;
  } catch { /* timeout */ }
  console.log('détail chargé:', loaded);
  await new Promise(res => setTimeout(res, 1500));
  await page.screenshot({ path: 'scripts/shot-2-santalucia.png', fullPage: true });
  console.log('Capture 2 (Santa Lucia) ✓');

  await browser.close();
  console.log('Terminé.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
