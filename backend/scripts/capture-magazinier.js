// Capture du flux Magazinier → Partenaires (onglet intégré « Partenaires » : Commandes + À préparer).
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const FRONT = 'http://localhost:5180';
const API = 'http://localhost:3004/api';
const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = CANDIDATES.find(p => fs.existsSync(p));

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) });
  const { access_token: token } = await r.json();
  if (!token) throw new Error('pas de jeton');

  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1366, height: 820 } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  [page error]', e.message));

  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('access_token', t), token);
  await page.goto(`${FRONT}/magazinier`, { waitUntil: 'networkidle2' });
  await sleep(3000);

  const clickByText = (txt) => page.evaluate(t => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === t);
    if (b) { b.click(); return true; } return false;
  }, txt);

  // Ouvrir l'onglet Partenaires (sidebar magazinier)
  const okPart = await clickByText('Partenaires');
  console.log('clic Partenaires:', okPart);
  // attendre que la liste des commandes soit chargée (un numéro CMD- apparaît)
  await page.waitForFunction(() => /CMD-\d/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  await sleep(1500);
  await page.screenshot({ path: 'scripts/shot-mag-commandes.png', fullPage: true });
  console.log('Capture Commandes ✓');

  // Onglet « À préparer »
  const okPrep = await clickByText('À préparer');
  console.log('clic À préparer:', okPrep);
  await page.waitForFunction(() => /À servir|à préparer|Reste/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  await sleep(1500);
  // Test dépassement stock : saisir une quantité énorme dans le 1er champ « À servir »
  const input = await page.$('input[type=number]');
  if (input) { await input.click({ clickCount: 3 }); await input.type('9999'); }
  await sleep(1200);
  await page.screenshot({ path: 'scripts/shot-mag-preparer.png', fullPage: true });
  console.log('Capture À préparer ✓ (test dépassement)');

  await browser.close();
  console.log('Terminé.');
})().catch(e => { console.error('❌', e.message); process.exit(1); });
