// Vérifie le rendu imprimé du ticket caisse (surtout le pied « Merci/offre »).
// Reproduit fidèlement buildReceiptHTML (version corrigée) + données d'exemple,
// puis génère : une image + 2 PDF d'impression (page auto & page courte forcée)
// pour contrôler la pagination du pied. Usage : node scripts/capture-ticket.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const exe = CANDIDATES.find(p => fs.existsSync(p));

// ── copie fidèle de buildReceiptHTML (frontend/src/components/ReceiptPrint.tsx) ──
const truncName = n => (n.length > 40 ? n.slice(0, 40).trimEnd() + '…' : n);
const formatVolume = (valeur, unit) => (valeur ? `${valeur}` : '');
function buildReceiptHTML(data) {
  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const f = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const totalDiscount = data.items.reduce((s, item) => (item.discount > 0 && item.originalPrice) ? s + (item.originalPrice - item.unitPrice) * item.quantity : s, 0);
  const itemRows = data.items.map(item => {
    const sub = f(item.quantity * item.unitPrice);
    const hasDiscount = item.discount && item.discount > 0 && item.originalPrice;
    const prixLigne = hasDiscount ? `<span style="text-decoration:line-through;color:#999;font-size:10px;margin-right:4px">${f(item.originalPrice)}</span>${f(item.unitPrice)}` : f(item.unitPrice);
    const badge = hasDiscount ? `<span style="background:#c0392b;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:2px;margin-left:4px">-${item.discount}%</span>` : '';
    const meta = [formatVolume(item.valeur, item.unit), item.localName].filter(Boolean).join(' · ');
    const localNameRow = meta ? `<div class="ilocal">${meta}</div>` : '';
    return `\n    <div class="item">\n      <div class="iname">${truncName(item.name)}${badge}</div>\n      ${localNameRow}\n      <div class="irow">\n        <span>${item.quantity} x ${prixLigne}</span>\n        <span>${sub}</span>\n      </div>\n    </div>`;
  }).join('');
  const aReduction = totalDiscount > 0 || (data.offrePct ?? 0) > 0;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Recu ${data.receiptNo}</title><style>
    @page { size: 80mm auto; margin: 0; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000 !important; }
    html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
    body { padding: 8px 9mm 8px 9mm; }
    .center{ text-align: center; }
    .solid { border-top: 2px solid #000; margin: 9px 0; }
    .dash  { border-top: 1px dashed #000; margin: 8px 0; }
    .store { font-size: 23px; font-weight: 700; line-height: 1.05; }
    .rdct  { font-size: 10px; letter-spacing: 1px; margin-top: 3px; }
    .tag   { font-size: 11px; margin-top: 2px; }
    .info  { display: flex; justify-content: space-between; gap: 6px; font-size: 9px; line-height: 1.5; }
    .info .r { text-align: right; white-space: nowrap; }
    .legal { text-align: center; font-size: 9px; margin-top: 5px; }
    .item  { margin: 6px 0; }
    .iname { font-size: 13px; font-weight: 700; line-height: 1.25; white-space: normal; overflow-wrap: anywhere; }
    .ilocal{ font-size: 9px; color: #666; margin-top: 1px; }
    .irow  { display: flex; justify-content: space-between; font-size: 11px; color: #333; margin-top: 2px; }
    .row   { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
    .total { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 18px; font-weight: 700; margin: 6px 0; }
    .pay   { font-size: 11px; line-height: 1.65; }
    .merci { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 2px 0; }
    .offer { font-size: 9px; line-height: 1.35; }
    .nb    { font-size: 8.5px; line-height: 1.35; margin-top: 6px; }
    .foot  { page-break-inside: avoid; break-inside: avoid; }
</style></head><body>
  <div class="center"><div class="store">Family Store</div><div class="rdct">BY RDCT</div><div class="tag">Beaut&eacute; &bull; Saveur &bull; Bien-&ecirc;tre</div></div>
  <div class="solid"></div>
  <div class="info"><div class="l"><div>Ticket : #${data.receiptNo}</div><div>Date : ${dateStr}&nbsp;&nbsp;${timeStr}</div><div>Caissier : ${data.cashierName}</div></div>
  <div class="r"><div>Bonamoussadi &ndash; Douala</div><div>T&eacute;l. : +237 694060524</div><div>T&eacute;l. : +237 682634355</div></div></div>
  <div class="legal">NIU : MO22118477039J &bull; RC : RC/DLN/2021/B/392</div>
  <div class="solid"></div>
  ${itemRows}
  ${aReduction ? `<div class="dash"></div><div class="row"><span>Sous-total</span><span>${f(data.subtotal)}</span></div>${totalDiscount > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction produits</span><span>-${f(totalDiscount)}</span></div>` : ''}${(data.offrePct ?? 0) > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction facture (-${data.offrePct}%)</span><span>-${f(data.offreAmt ?? 0)}</span></div>` : ''}` : ''}
  <div class="solid"></div>
  <div class="total"><span>Total :</span><span>${f(data.total)} FCFA</span></div>
  <div class="solid"></div>
  <div class="pay">Mode de paiement : ${data.paymentLabel}</div>
  <div class="pay">Montant re&ccedil;u : ${f(data.amountPaid)} FCFA</div>
  ${data.change > 0 ? `<div class="pay">Montant rembours&eacute; : ${f(data.change)} FCFA</div>` : ''}
  <div style="height:6px"></div>
  <div class="center foot"><div class="merci">Merci de votre visite !</div><div class="offer">Pour vous remercier, <b>Family Store vous offre 5&nbsp;%</b> de r&eacute;duction sur votre prochain achat. Pr&eacute;sentez simplement cette facture &agrave; la caisse pour b&eacute;n&eacute;ficier de cette offre.</div><div class="nb"><b>NB&nbsp;:</b> Les articles achet&eacute;s ou livr&eacute;s ne sont ni &eacute;chang&eacute;s ni repris. Ils seront v&eacute;rifi&eacute;s et approuv&eacute;s par le client.</div></div>
</body></html>`;
}

const sample = {
  receiptNo: 'A1B2C3', date: new Date('2026-07-02T10:24:00'), cashierName: 'Admin Patron',
  items: [
    { name: 'Argan Oil Spray Collagène Infused', localName: 'Huile Mèches', unit: 'pièce', valeur: '250mL', quantity: 2, unitPrice: 2500, originalPrice: 3000, discount: 17 },
    { name: 'Baby Love Kopf Bis Fuss Waschgel Sensitive', localName: 'Gel Douche', unit: 'pièce', quantity: 1, unitPrice: 3500 },
    { name: 'Deo Roll On Balea Men', unit: 'pièce', valeur: '50mL', quantity: 3, unitPrice: 1200 },
    { name: 'Bain de Bouche Antibacteriel', unit: 'pièce', valeur: '500mL', quantity: 1, unitPrice: 2000 },
  ],
  subtotal: 14100, total: 13395, paymentLabel: 'Espèces', amountPaid: 15000, change: 1605, offrePct: 5, offreAmt: 705,
};

(async () => {
  if (!exe) { console.error('Aucun navigateur'); process.exit(1); }
  const html = buildReceiptHTML(sample);
  const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 340, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.screenshot({ path: 'scripts/shot-ticket.png', fullPage: true });
  console.log('Image ticket ✓ (scripts/shot-ticket.png)');
  // PDF page AUTO (honore @page 80mm auto) → doit tenir en 1 page
  await page.pdf({ path: 'scripts/ticket-auto.pdf', width: '80mm', printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  console.log('PDF auto ✓ (scripts/ticket-auto.pdf)');
  // Hauteur EXACTE mesurée (comme le nouveau doPrint) → doit donner UNE seule page complète
  const hMm = await page.evaluate(() => Math.ceil((document.body.scrollHeight * 25.4) / 96) + 4);
  console.log(`Hauteur mesurée du ticket : ${hMm}mm`);
  await page.pdf({ path: 'scripts/ticket-exact.pdf', width: '80mm', height: `${hMm}mm`, printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  console.log('PDF hauteur exacte ✓ (scripts/ticket-exact.pdf)');
  await browser.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
