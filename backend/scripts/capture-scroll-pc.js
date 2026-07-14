// Vérifie le défilement pleine page sur PC (1366×768) pour les pages Stock.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const FRONT = 'http://localhost:5180';
const API = 'http://localhost:3004/api';
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGES = ['/stocks/receptions', '/stocks/inventaire', '/stocks/alertes', '/stocks/depots', '/stocks/fournisseurs', '/stocks/ecarts', '/stocks/divers'];

(async () => {
  const { access_token: token } = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) })).json();
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1366, height: 768 } });
  for (const path of PAGES) {
    const page = await browser.newPage();
    await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate(t => localStorage.setItem('access_token', t), token);
    await page.goto(`${FRONT}${path}`, { waitUntil: 'networkidle2' });
    await sleep(2200);
    const r = await page.evaluate(() => {
      const m = document.querySelector('main');
      const b = m.scrollTop; m.scrollTop = m.scrollHeight;
      return { moved: m.scrollTop - b, sh: m.scrollHeight, ch: m.clientHeight };
    });
    const fits = r.sh <= r.ch + 2;
    console.log(`${path.padEnd(22)} contenu=${r.sh}px visible=${r.ch}px → ${fits ? 'tient à l\'écran ✓' : (r.moved > 0 ? `défile ✓ (${r.moved}px)` : '❌ BLOQUÉ')}`);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
