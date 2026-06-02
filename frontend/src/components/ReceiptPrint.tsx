// Utilitaires impression reçu thermique 80mm + gestion paramètres d'impression
import { jsPDF } from 'jspdf';

export interface ReceiptItem {
  name:          string;
  localName?:    string;
  unit:          string;
  quantity:      number;
  unitPrice:     number;
  originalPrice?: number;
  discount?:     number;
}

export interface ReceiptData {
  receiptNo:      string;
  date:           Date;
  cashierName:    string;
  storePhone?:    string;
  items:          ReceiptItem[];
  subtotal:       number;  // avant réduction facture
  total:          number;  // après réduction facture
  paymentLabel:   string;
  amountPaid:     number;
  change:         number;
  offrePct?:      number;  // % réduction sur facture (ex: 5)
  offreAmt?:      number;  // montant déduit (ex: 250)
}

export interface PrintSettings {
  auto:    boolean;
  copies:  number;
}

export const PRINT_DEFAULTS: PrintSettings = {
  auto:    false,
  copies:  1,
};

const LS_KEY = 'fs_print_settings';

export function getPrintSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...PRINT_DEFAULTS };
    return { ...PRINT_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...PRINT_DEFAULTS };
  }
}

export function savePrintSettings(s: PrintSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

// Tronque un nom de produit trop long (> 40 caractères) avec une ellipse.
const truncName = (n: string) => (n.length > 40 ? n.slice(0, 40).trimEnd() + '…' : n);

export function buildReceiptHTML(data: ReceiptData): string {
  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const totalDiscount = data.items.reduce((s, item) => {
    if ((item.discount ?? 0) > 0 && item.originalPrice) {
      return s + (item.originalPrice - item.unitPrice) * item.quantity;
    }
    return s;
  }, 0);

  const itemRows = data.items.map(item => {
    const sub        = (item.quantity * item.unitPrice).toLocaleString('fr-FR');
    const hasDiscount = item.discount && item.discount > 0 && item.originalPrice;
    const prixLigne  = hasDiscount
      ? `<span style="text-decoration:line-through;color:#999;font-size:10px;margin-right:4px">${item.originalPrice!.toLocaleString('fr-FR')}</span>${item.unitPrice.toLocaleString('fr-FR')}`
      : item.unitPrice.toLocaleString('fr-FR');
    const badge      = hasDiscount
      ? `<span style="background:#c0392b;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:2px;margin-left:4px">-${item.discount}%</span>`
      : '';
    const localNameRow = item.localName
      ? `<div class="ilocal">${item.localName}</div>`
      : '';
    return `
    <div class="item">
      <div class="iname">${truncName(item.name)}${badge}</div>
      ${localNameRow}
      <div class="irow">
        <span>${item.quantity} &times; ${prixLigne}</span>
        <span class="bold">${sub} XAF</span>
      </div>
    </div>`;
  }).join('');

  const monnaieRow = data.change > 0
    ? `<div class="row bold"><span>Monnaie</span><span>${data.change.toLocaleString('fr-FR')} XAF</span></div>`
    : '';

  // Message d'offre fidélité affiché sur TOUS les tickets.
  const footMessage =
    `<p class="foot" style="font-weight:bold;">Merci pour votre achat</p>
     <p class="foot">Comme remerciement, <b>Family Store vous offre 5 % de r&eacute;duction</b> sur votre prochain achat.</p>
     <p class="foot">Pr&eacute;sentez juste cette facture &agrave; la caisse pour en b&eacute;n&eacute;ficier.</p>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Recu ${data.receiptNo}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * {
      margin: 0; padding: 0; box-sizing: border-box;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #000 !important;
    }
    html, body {
      width: 80mm;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    body { padding: 8px 10px 16px; }
    .center{ text-align: center; }
    .bold  { font-weight: bold; }
    .solid { border-top: 2px solid #000; margin: 7px 0 13px; }
    .dash  { border-top: 1px dashed #000; margin: 6px 0 12px; }
    .store { font-size: 19px; font-weight: 900; letter-spacing: 3px; }
    .sub   { font-size: 11px; margin: 2px 0; }
    .meta  { font-size: 12px; margin: 2px 0; }
    .item  { margin: 5px 0; }
    .iname { font-size: 13px; font-weight: 600; }
    .ilocal{ font-size: 10px; color: #666; margin-top: 1px; }
    .irow  { display: flex; justify-content: space-between; font-size: 12px; padding-left: 4px; }
    .row   { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; }
    .total { font-size: 16px; font-weight: 900; margin: 5px 0; }
    .foot  { font-size: 11px; margin: 2px 0; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store">FAMILY STORE</div>
    <div class="sub">by RDCT</div>
    <div class="sub">Beaut&eacute; &middot; Saveurs &middot; Bien-&ecirc;tre</div>
    <div class="sub" style="margin-top:3px;font-weight:bold;">Point de Vente</div>
    <div class="sub" style="font-weight:bold;">Bonamoussadi &middot; Douala</div>
    <div class="sub" style="font-weight:bold;">Tel: ${data.storePhone || '682 263 435'}</div>
  </div>
  <div class="solid"></div>
  <p class="meta">Ticket   : #${data.receiptNo}</p>
  <p class="meta">Date     : ${dateStr}  ${timeStr}</p>
  <p class="meta">Caissier : ${data.cashierName}</p>
  <div class="dash"></div>
  ${itemRows}
  <div class="dash"></div>
  <div class="row"><span>Sous-total</span><span>${data.subtotal.toLocaleString('fr-FR')} XAF</span></div>
  ${totalDiscount > 0 ? `<div class="row" style="color:#c0392b !important;font-weight:bold;"><span>R&eacute;duction produits</span><span>-${totalDiscount.toLocaleString('fr-FR')} XAF</span></div>` : ''}
  ${(data.offrePct ?? 0) > 0 ? `<div class="row" style="color:#c0392b !important;font-weight:bold;"><span>R&eacute;duction facture (-${data.offrePct}%)</span><span>-${(data.offreAmt ?? 0).toLocaleString('fr-FR')} XAF</span></div>` : ''}
  <div class="solid"></div>
  <div class="row total"><span>TOTAL</span><span>${data.total.toLocaleString('fr-FR')} XAF</span></div>
  <div class="solid"></div>
  <p class="meta">Paiement : ${data.paymentLabel}</p>
  <div class="row"><span>Re&ccedil;u</span><span>${data.amountPaid.toLocaleString('fr-FR')} XAF</span></div>
  ${monnaieRow}
  <div class="dash"></div>
  <div class="center">
    ${footMessage}
    <p class="foot" style="margin-top:5px;">Bonamoussadi &middot; Douala</p>
    <p class="foot">Tel: 682 263 435</p>
    <p class="foot" style="margin-top:4px;font-size:9px;">Family Store POS &copy; ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}

export function doPrint(html: string, copies = 1) {
  for (let i = 0; i < copies; i++) {
    setTimeout(() => {
      const w = window.open('', '_blank', 'width=350,height=700,menubar=no,toolbar=no');
      if (!w) { if (i === 0) alert('Autorisez les popups pour imprimer.'); return; }
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try { w.focus(); w.print(); setTimeout(() => w.close(), 1200); } catch { /* ignore */ }
      }, 400);
    }, i * 1000);
  }
}

// Génération PDF reçu (base64) pour archivage ─────────────────────────────────

export function buildReceiptPDF(data: ReceiptData): string {
  const doc  = new jsPDF({ unit: 'mm', format: [80, 220], orientation: 'portrait' });
  const W    = 76; // largeur utile
  let   y    = 6;

  const line  = (text: string, size = 9, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(size);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    const x = align === 'center' ? W / 2 + 2 : align === 'right' ? W + 2 : 2;
    doc.text(text, x, y, { align });
    y += size * 0.42;
  };
  const row = (left: string, right: string, size = 9, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.text(left,  2,      y);
    doc.text(right, W + 2,  y, { align: 'right' });
    y += size * 0.42;
  };
  const dash  = () => { doc.setLineWidth(0.2); (doc as any).setLineDash([1, 1]); doc.line(2, y, W + 2, y); y += 4; };
  const solid = () => { doc.setLineWidth(0.4); (doc as any).setLineDash([]);    doc.line(2, y, W + 2, y); y += 4.5; };

  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmt = (n: number) => n.toLocaleString('fr-FR');

  // En-tête
  line('FAMILY STORE', 14, true, 'center'); y += 1;
  line('by RDCT', 8, false, 'center');
  line('Beaute · Saveurs · Bien-etre', 7, false, 'center');
  line('Point de Vente', 8, true, 'center');
  line('Bonamoussadi · Douala', 8, true, 'center');
  line(`Tel: ${data.storePhone || '682 263 435'}`, 8, true, 'center');
  y += 1;
  solid();

  // Méta
  line(`Ticket   : #${data.receiptNo}`, 8);
  line(`Date     : ${dateStr}  ${timeStr}`, 8);
  line(`Caissier : ${data.cashierName}`, 8);
  y += 1;
  dash();

  // Articles
  for (const item of data.items) {
    line(truncName(item.name), 9, true);
    if (item.localName) line(item.localName, 7, false);
    row(
      `  ${item.quantity} x ${fmt(item.unitPrice)}`,
      `${fmt(item.quantity * item.unitPrice)} XAF`,
      8,
    );
    y += 0.5;
  }
  dash();

  // Totaux
  const pdfDiscount = data.items.reduce((s, item) => {
    if ((item.discount ?? 0) > 0 && item.originalPrice) {
      return s + (item.originalPrice - item.unitPrice) * item.quantity;
    }
    return s;
  }, 0);
  row('Sous-total', `${fmt(data.total)} XAF`, 8);
  if (pdfDiscount > 0) row(`Reduction appliquee`, `-${fmt(pdfDiscount)} XAF`, 8);
  solid();
  row('TOTAL', `${fmt(data.total)} XAF`, 12, true);
  solid();

  // Paiement
  line(`Paiement : ${data.paymentLabel}`, 8);
  row('Recu', `${fmt(data.amountPaid)} XAF`, 8);
  if (data.change > 0) row('Monnaie', `${fmt(data.change)} XAF`, 9, true);
  dash();

  // Pied
  y += 1;
  line('Merci pour votre achat', 9, true, 'center');
  line('Family Store vous offre 5% de reduction', 8, true, 'center');
  line('sur votre prochain achat.', 8, false, 'center');
  line('Presentez cette facture a la caisse', 7, false, 'center');
  line('pour en beneficier.', 7, false, 'center');
  line('Bonamoussadi · Douala', 7, false, 'center');
  line('Tel: 682 263 435', 7, false, 'center');

  return doc.output('datauristring').split(',')[1] ?? '';
}

// Ouverture tiroir-caisse via ESC/POS (navigator.serial — nécessite HTTPS + autorisation)
export async function openCashDrawer() {
  if (!('serial' in navigator)) return;
  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    // ESC p 0 25 250
    await writer.write(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    writer.releaseLock();
    await port.close();
  } catch { /* annulé ou non supporté */ }
}
