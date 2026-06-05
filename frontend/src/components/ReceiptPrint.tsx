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
        <span>${item.quantity} x ${prixLigne}</span>
        <span>${sub}</span>
      </div>
    </div>`;
  }).join('');

  const aReduction = totalDiscount > 0 || (data.offrePct ?? 0) > 0;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Recu ${data.receiptNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * {
      margin: 0; padding: 0; box-sizing: border-box;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px; color: #000 !important;
    }
    html, body { width: 80mm; margin: 0; padding: 0; background: #fff; }
    body { padding: 10px 10px 16px; }
    .center{ text-align: center; }
    .solid { border-top: 2px solid #000; margin: 8px 0; }
    .dash  { border-top: 1px dashed #000; margin: 8px 0; }
    .store { font-size: 26px; font-weight: 700; }
    .rdct  { font-size: 9px; letter-spacing: 2px; margin-top: 1px; }
    .tag   { font-size: 11px; margin-top: 2px; }
    .info  { display: flex; justify-content: space-between; font-size: 11px; line-height: 1.5; }
    .info .r { text-align: right; }
    .item  { margin: 6px 0; }
    .iname { font-size: 15px; font-weight: 700; }
    .ilocal{ font-size: 10px; color: #666; margin-top: 1px; }
    .irow  { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-top: 3px; }
    .row   { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .total { display: flex; justify-content: space-between; align-items: baseline; font-size: 20px; font-weight: 700; margin: 4px 0; }
    .pay   { font-size: 11px; line-height: 1.6; }
    .merci { font-size: 15px; font-weight: 700; letter-spacing: 3px; margin: 4px 0; }
    .offer { font-size: 11px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store">Family Store</div>
    <div class="rdct">BY RDCT</div>
    <div class="tag">Beaut&eacute; . Saveur . Bien-etre</div>
  </div>
  <div class="solid"></div>
  <div class="info">
    <div class="l">
      <div>Ticket: #${data.receiptNo}</div>
      <div>Date: ${dateStr}&nbsp;&nbsp;${timeStr}</div>
      <div>Caissier: ${data.cashierName}</div>
    </div>
    <div class="r">
      <div>Bonamoussadi &ndash; Douala</div>
      <div>Tel: +237 670792691</div>
      <div>Tel: +237 682263435</div>
    </div>
  </div>
  <div class="solid"></div>
  ${itemRows}
  <div class="dash"></div>
  ${aReduction ? `
  <div class="row"><span>Sous-total</span><span>${data.subtotal.toLocaleString('fr-FR')}</span></div>
  ${totalDiscount > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction produits</span><span>-${totalDiscount.toLocaleString('fr-FR')}</span></div>` : ''}
  ${(data.offrePct ?? 0) > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction facture (-${data.offrePct}%)</span><span>-${(data.offreAmt ?? 0).toLocaleString('fr-FR')}</span></div>` : ''}
  ` : ''}
  <div class="solid"></div>
  <div class="total"><span>Total:</span><span>${data.total.toLocaleString('fr-FR')} XFCA</span></div>
  <div class="solid"></div>
  <div class="pay">Moyen de paiement: ${data.paymentLabel}</div>
  <div class="pay">Montant re&ccedil;u: ${data.amountPaid.toLocaleString('fr-FR')} Francs CFA</div>
  ${data.change > 0 ? `<div class="pay">Montant rembours&eacute;: ${data.change.toLocaleString('fr-FR')} Francs CFA</div>` : ''}
  <div style="height:10px"></div>
  <div class="center">
    <div class="merci">Merci de votre visite !</div>
    <div class="offer">Comme remerciement, <b>Family Store vous offre 5 %</b> de r&eacute;duction sur votre prochain achat. Pr&eacute;sentez juste cette facture &agrave; la caisse pour b&eacute;n&eacute;ficier de cette offre.</div>
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
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const x = align === 'center' ? W / 2 + 2 : align === 'right' ? W + 2 : 2;
    doc.text(text, x, y, { align });
    y += size * 0.42;
  };
  const row = (left: string, right: string, size = 9, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
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
  line('Family Store', 18, true, 'center');
  line('BY RDCT', 7, false, 'center');
  line('Beaute . Saveur . Bien-etre', 8, false, 'center');
  y += 1;
  solid();

  // Infos : meta (gauche) + adresse/contacts (droite)
  const infoL = [
    `Ticket: #${data.receiptNo}`,
    `Date: ${dateStr}  ${timeStr}`,
    `Caissier: ${data.cashierName}`,
  ];
  const infoR = ['Bonamoussadi - Douala', 'Tel: +237 670792691', 'Tel: +237 682263435'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  for (let i = 0; i < 3; i++) {
    doc.text(infoL[i], 2, y);
    doc.text(infoR[i], W + 2, y, { align: 'right' });
    y += 8 * 0.46;
  }
  y += 1;
  solid();

  // Articles
  for (const item of data.items) {
    line(truncName(item.name), 11, true);
    if (item.localName) line(item.localName, 7, false);
    row(`  ${item.quantity} x ${fmt(item.unitPrice)}`, `${fmt(item.quantity * item.unitPrice)}`, 9);
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
  if (pdfDiscount > 0 || (data.offrePct ?? 0) > 0) {
    row('Sous-total', `${fmt(data.subtotal)}`, 8);
    if (pdfDiscount > 0) row('Reduction produits', `-${fmt(pdfDiscount)}`, 8);
    if ((data.offrePct ?? 0) > 0) row(`Reduction facture (-${data.offrePct}%)`, `-${fmt(data.offreAmt ?? 0)}`, 8);
  }
  solid();
  row('Total:', `${fmt(data.total)} XFCA`, 14, true);
  solid();

  // Paiement
  line(`Moyen de paiement: ${data.paymentLabel}`, 8);
  line(`Montant recu: ${fmt(data.amountPaid)} Francs CFA`, 8);
  if (data.change > 0) line(`Montant rembourse: ${fmt(data.change)} Francs CFA`, 8);
  y += 3;

  // Pied
  line('Merci de votre visite !', 11, true, 'center');
  line('Comme remerciement, Family Store vous offre 5%', 8, false, 'center');
  line('de reduction sur votre prochain achat.', 8, false, 'center');
  line('Presentez juste cette facture a la caisse', 7, false, 'center');
  line('pour beneficier de cette offre.', 7, false, 'center');

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
