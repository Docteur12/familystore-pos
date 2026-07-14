// Test Phase 2 — gestionnaire hors-ligne :
// A) idempotence /stock/add (rejeu → une seule fois)
// B) UI : création produit hors-ligne dans le catalogue → bandeau → synchro auto → serveur
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const FRONT = 'http://localhost:5180';
const API = 'http://localhost:3004/api';
const exe = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOM = `Produit Gest Offline ${Date.now() % 100000}`;
const eq = (c, msg) => console.log(`${c ? '✅' : '❌'} ${msg}`);

(async () => {
  const { access_token: token } = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@familystore.cm', password: 'admin123' }) })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ── A) Idempotence /stock/add ──
  const prods = await (await fetch(`${API}/products`, { headers: H })).json();
  const p = prods[0];
  const s0 = p.stock;
  const key = `test-add-${Date.now()}`;
  const body = JSON.stringify({ productId: p._id, quantity: 3, idempotencyKey: key });
  await fetch(`${API}/stock/add`, { method: 'POST', headers: H, body });
  const r2 = await (await fetch(`${API}/stock/add`, { method: 'POST', headers: H, body })).json(); // REJEU
  eq(r2.newStock === s0 + 3, `stock/add idempotent : rejeu → ${r2.newStock} (attendu ${s0 + 3}, pas ${s0 + 6})`);
  // remise en état
  await fetch(`${API}/products/${p._id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ stock: s0 }) });

  // ── B) UI hors-ligne : création produit gestionnaire ──
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'], defaultViewport: { width: 1366, height: 900 } });
  const page = await browser.newPage();
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(t => localStorage.setItem('access_token', t), token);
  await page.goto(`${FRONT}/stocks`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => /Catalogue produits/i.test(document.body.innerText), { timeout: 12000 });
  await sleep(2500);

  await page.setOfflineMode(true);
  console.log('📴 Réseau coupé');

  // Ouvrir le modal « Nouveau produit »
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Nouveau produit/.test(x.textContent || '')); b && b.click(); });
  await sleep(800);
  // Remplir nom / prix de vente / stock
  await page.type('input[placeholder="ex: Nivea Shampoing 400ml"]', NOM);
  // Marque les champs prix/stock puis tape au clavier (vrais événements React)
  await page.evaluate(() => {
    const labels = [...document.querySelectorAll('label')];
    const lp = labels.find(l => /Prix de vente/.test(l.textContent || ''));
    if (lp) { const inp = lp.parentElement.querySelector('input[type="number"]'); if (inp) inp.id = 'dbg-prix'; }
    const lst = labels.find(l => /Stock initial/.test(l.textContent || ''));
    if (lst) { const inp = lst.parentElement.querySelector('input[type="number"]'); if (inp) inp.id = 'dbg-stock'; }
  });
  await page.type('#dbg-prix', '1500');
  await page.type('#dbg-stock', '4');
  await sleep(300);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Enregistrer le produit/.test(x.textContent || '')); b && b.click(); });
  await sleep(1500);

  const bandeau = await page.evaluate(() => document.body.innerText.includes('enregistré(s) hors connexion'));
  eq(bandeau, 'bandeau hors-ligne visible sur le catalogue');
  // Le produit apparaît dans la recherche locale
  await page.type('input[placeholder="Rechercher SKU, nom, fournisseur..."]', NOM.slice(0, 18));
  await sleep(800);
  const visible = await page.evaluate(n => document.body.innerText.includes(n), NOM);
  eq(visible, 'produit créé hors-ligne visible dans le catalogue/recherche');

  // ── Retour du réseau → synchro auto ──
  await page.setOfflineMode(false);
  console.log('📶 Réseau rétabli');
  await sleep(4000);
  const bandeauParti = await page.evaluate(() => !document.body.innerText.includes('enregistré(s) hors connexion'));
  eq(bandeauParti, 'bandeau disparu après synchro automatique');
  await browser.close();

  // ── Vérification serveur + nettoyage ──
  const prods2 = await (await fetch(`${API}/products`, { headers: H })).json();
  const created = prods2.find(x => x.name === NOM);
  eq(!!created, `produit créé côté serveur${created ? ` (stock ${created.stock}, prix ${created.price})` : ''}`);
  if (created) {
    await fetch(`${API}/products/${created._id}`, { method: 'DELETE', headers: H });
    console.log('🧹 Produit de test supprimé.');
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
