// Capture du tableau de bord admin (pour vérifier la carte « Partenaires — créances »).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const API = 'http://localhost:3004/api';
async function findFront() {
  for (const p of [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180]) {
    try { const r = await fetch('http://localhost:' + p, { signal: AbortSignal.timeout(2000) }); const t = await r.text(); if (/fs-wine|Family Store/i.test(t)) return 'http://localhost:' + p; } catch { /* port suivant */ }
  }
  throw new Error('Frontend Family Store introuvable (ports 5173-5180)');
}
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const FRONT = await findFront();
  console.log('Frontend Family Store détecté sur', FRONT);
  const { access_token: token } = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) })).json();
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox', '--disable-gpu'], defaultViewport: { width: 1366, height: 820 } });
  const page = await browser.newPage();
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('access_token', t), token);
  await page.goto(`${FRONT}/admin/dashboard`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /créances|Chiffre d'affaires/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: 'scripts/shot-admin.png' });
  console.log('Capture admin ✓');

  // Page de gestion des comptes Partenaires
  await page.goto(`${FRONT}/admin/partenaires`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /Comptes Partenaires|compte partenaire/i.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  await sleep(2000);
  await page.screenshot({ path: 'scripts/shot-admin-partenaires.png' });
  console.log('Capture admin/partenaires ✓');
  await browser.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
