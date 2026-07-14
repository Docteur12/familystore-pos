// Test bout-en-bout du mode hors-ligne magazinier :
// coupure réseau simulée → création produit + réception locale → retour du
// réseau → synchronisation automatique → vérification côté serveur.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const FRONT = 'http://localhost:5180';
const API = 'http://localhost:3004/api';
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOM = `Produit Test Offline ${Date.now() % 100000}`;

(async () => {
  const { access_token: token } = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) })).json();
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1366, height: 900 } });
  const page = await browser.newPage();
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('access_token', t), token);
  await page.goto(`${FRONT}/magazinier`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /Réceptions/i.test(document.body.innerText), { timeout: 12000 });
  await sleep(2500);

  // ── 1. COUPURE RÉSEAU ──
  await page.setOfflineMode(true);
  console.log('📴 Réseau coupé');

  // ── 2. Créer un produit hors-ligne ──
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Nouveau produit/.test(x.textContent || '')); b && b.click(); });
  await sleep(600);
  await page.type('input[placeholder="Nom du produit *"]', NOM);
  await page.type('input[placeholder="Qté reçue"]', '7');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Créer le produit/.test(x.textContent || '')); b && b.click(); });
  await sleep(1500);
  const bandeau1 = await page.evaluate(() => document.body.innerText.includes('enregistré(s) hors connexion'));
  console.log(bandeau1 ? '✅ produit en file locale (bandeau visible)' : '❌ bandeau absent');

  // ── 3. Valider la réception hors-ligne (le produit y a été ajouté automatiquement) ──
  await page.type('input[placeholder*="fournisseur" i], input[placeholder*="Nom du fournisseur" i]', 'FOURNISSEUR TEST').catch(() => {});
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Valider la réception/.test(x.textContent || '')); b && b.click(); });
  await sleep(1500);
  const bandeau2 = await page.evaluate(() => {
    const t = document.body.innerText;
    return /1 produit\(s\) et 1 réception\(s\)/.test(t) || (/produit\(s\)/.test(t) && /réception\(s\)/.test(t));
  });
  console.log(bandeau2 ? '✅ réception en file locale (bandeau : produit + réception)' : '⚠ bandeau réception à vérifier');
  await page.screenshot({ path: 'scripts/shot-offline-1.png' });

  // ── 4. RETOUR DU RÉSEAU → synchro automatique ──
  await page.setOfflineMode(false);
  console.log('📶 Réseau rétabli');
  await sleep(4000);
  const bandeauParti = await page.evaluate(() => !document.body.innerText.includes('enregistré(s) hors connexion'));
  console.log(bandeauParti ? '✅ bandeau disparu après synchro automatique' : '⚠ bandeau encore présent (synchro non déclenchée ?)');
  await page.screenshot({ path: 'scripts/shot-offline-2.png' });
  await browser.close();

  // ── 5. Vérification côté serveur ──
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const prods = await (await fetch(`${API}/products`, { headers: H })).json();
  const created = prods.find(p => p.name === NOM);
  console.log(created ? `✅ produit créé côté serveur (${created._id}) — stock entrepôt : ${created.stockMagazin}` : '❌ produit absent du serveur');
  if (created && created.stockMagazin === 7) console.log('✅ réception synchronisée : stock entrepôt = 7');
  else if (created) console.log(`⚠ stock entrepôt = ${created.stockMagazin} (attendu 7)`);

  // Nettoyage du produit de test
  if (created) {
    await fetch(`${API}/products/${created._id}`, { method: 'DELETE', headers: H });
    console.log('🧹 Produit de test supprimé.');
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
