// Utilitaires impression reçu thermique 80mm + gestion paramètres d'impression
import { jsPDF } from 'jspdf';
import { formatVolume } from '../utils/text';

export interface ReceiptItem {
  name:          string;
  localName?:    string;
  unit:          string;
  valeur?:       string;
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
  // Séparateur de milliers = espace ASCII normale (pas l'espace insécable
  // U+202F de toLocaleString, que l'imprimante thermique rend comme un "/").
  const f = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  const totalDiscount = data.items.reduce((s, item) => {
    if ((item.discount ?? 0) > 0 && item.originalPrice) {
      return s + (item.originalPrice - item.unitPrice) * item.quantity;
    }
    return s;
  }, 0);

  const itemRows = data.items.map(item => {
    const sub        = f(item.quantity * item.unitPrice);
    const hasDiscount = item.discount && item.discount > 0 && item.originalPrice;
    const prixLigne  = hasDiscount
      ? `<span style="text-decoration:line-through;color:#999;font-size:10px;margin-right:4px">${f(item.originalPrice!)}</span>${f(item.unitPrice)}`
      : f(item.unitPrice);
    const badge      = hasDiscount
      ? `<span style="background:#c0392b;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:2px;margin-left:4px">-${item.discount}%</span>`
      : '';
    const meta = [formatVolume(item.valeur, item.unit), item.localName].filter(Boolean).join(' · ');
    const localNameRow = meta
      ? `<div class="ilocal">${meta}</div>`
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
    /* Papier 80mm. L'imprimante a une marge NON imprimable des 2 côtés
       (~4-6mm) : on centre le contenu avec une marge égale à gauche ET à
       droite pour ne rien couper ni à gauche ni à droite. */
    @page { size: 80mm auto; margin: 0; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * {
      margin: 0; padding: 0; box-sizing: border-box;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px; color: #000 !important;
    }
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
    .item  { margin: 6px 0; }
    .iname { font-size: 13px; font-weight: 700; line-height: 1.25; white-space: normal; overflow-wrap: anywhere; }
    .ilocal{ font-size: 9px; color: #666; margin-top: 1px; }
    .irow  { display: flex; justify-content: space-between; font-size: 11px; color: #333; margin-top: 2px; }
    .row   { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
    .total { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; font-size: 18px; font-weight: 700; margin: 6px 0; }
    .pay   { font-size: 11px; line-height: 1.65; }
    .merci { font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 2px 0; }
    .offer { font-size: 9px; line-height: 1.35; }
    /* Le pied (Merci + offre) reste d'un seul tenant : jamais coupé en fin de page */
    .foot  { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store">Family Store</div>
    <div class="rdct">BY RDCT</div>
    <div class="tag">Beaut&eacute; &bull; Saveur &bull; Bien-&ecirc;tre</div>
  </div>
  <div class="solid"></div>
  <div class="info">
    <div class="l">
      <div>Ticket : #${data.receiptNo}</div>
      <div>Date : ${dateStr}&nbsp;&nbsp;${timeStr}</div>
      <div>Caissier : ${data.cashierName}</div>
    </div>
    <div class="r">
      <div>Bonamoussadi &ndash; Douala</div>
      <div>T&eacute;l. : +237 694060524</div>
      <div>T&eacute;l. : +237 682634355</div>
    </div>
  </div>
  <div class="solid"></div>
  ${itemRows}
  ${aReduction ? `
  <div class="dash"></div>
  <div class="row"><span>Sous-total</span><span>${f(data.subtotal)}</span></div>
  ${totalDiscount > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction produits</span><span>-${f(totalDiscount)}</span></div>` : ''}
  ${(data.offrePct ?? 0) > 0 ? `<div class="row" style="font-weight:bold;"><span>R&eacute;duction facture (-${data.offrePct}%)</span><span>-${f(data.offreAmt ?? 0)}</span></div>` : ''}
  ` : ''}
  <div class="solid"></div>
  <div class="total"><span>Total :</span><span>${f(data.total)} FCFA</span></div>
  <div class="solid"></div>
  <div class="pay">Mode de paiement : ${data.paymentLabel}</div>
  <div class="pay">Montant re&ccedil;u : ${f(data.amountPaid)} FCFA</div>
  ${data.change > 0 ? `<div class="pay">Montant rembours&eacute; : ${f(data.change)} FCFA</div>` : ''}
  <div style="height:6px"></div>
  <div class="center foot">
    <div class="merci">Merci de votre visite !</div>
    <div class="offer">Pour vous remercier, <b>Family Store vous offre 5&nbsp;%</b> de r&eacute;duction sur votre prochain achat. Pr&eacute;sentez simplement cette facture &agrave; la caisse pour b&eacute;n&eacute;ficier de cette offre.</div>
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
        // Page de la hauteur EXACTE du ticket : tout tient sur une seule page,
        // même si le pilote de l'imprimante est réglé sur une longueur fixe.
        // (Sinon le pied « Merci / offre -5% » déborde sur le segment suivant.)
        try {
          const hMm = Math.ceil((w.document.body.scrollHeight * 25.4) / 96) + 4;
          const st  = w.document.createElement('style');
          st.textContent = `@page { size: 80mm ${hMm}mm; margin: 0; }`;
          w.document.head.appendChild(st);
        } catch { /* mesure impossible → @page 80mm auto du HTML reste appliqué */ }
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
  const fmt = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // En-tête
  line('Family Store', 22, true, 'center');
  line('BY RDCT', 8, false, 'center');
  line('Beauté · Saveur · Bien-être', 9, false, 'center');
  y += 1;
  solid();

  // Infos : meta (gauche) + adresse/contacts (droite)
  const infoL = [
    `Ticket : #${data.receiptNo}`,
    `Date : ${dateStr}  ${timeStr}`,
    `Caissier : ${data.cashierName}`,
  ];
  const infoR = ['Bonamoussadi - Douala', 'Tél. : +237 694060524', 'Tél. : +237 682634355'];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  for (let i = 0; i < 3; i++) {
    doc.text(infoL[i], 2, y);
    doc.text(infoR[i], W + 2, y, { align: 'right' });
    y += 8 * 0.5;
  }
  y += 1;
  solid();

  // Articles
  for (const item of data.items) {
    line(truncName(item.name), 12, true);
    const meta = [formatVolume(item.valeur, item.unit), item.localName].filter(Boolean).join(' · ');
    if (meta) line(meta, 8, false);
    row(`  ${item.quantity} x ${fmt(item.unitPrice)}`, `${fmt(item.quantity * item.unitPrice)}`, 10);
    y += 0.5;
  }

  // Totaux — la ligne pointillée et le sous-total n'apparaissent QUE s'il y a une réduction
  const pdfDiscount = data.items.reduce((s, item) => {
    if ((item.discount ?? 0) > 0 && item.originalPrice) {
      return s + (item.originalPrice - item.unitPrice) * item.quantity;
    }
    return s;
  }, 0);
  if (pdfDiscount > 0 || (data.offrePct ?? 0) > 0) {
    dash();
    row('Sous-total', `${fmt(data.subtotal)}`, 9);
    if (pdfDiscount > 0) row('Réduction produits', `-${fmt(pdfDiscount)}`, 9);
    if ((data.offrePct ?? 0) > 0) row(`Réduction facture (-${data.offrePct}%)`, `-${fmt(data.offreAmt ?? 0)}`, 9);
  }
  solid();
  row('Total :', `${fmt(data.total)} FCFA`, 18, true);
  solid();

  // Paiement
  line(`Mode de paiement : ${data.paymentLabel}`, 9);
  line(`Montant reçu : ${fmt(data.amountPaid)} FCFA`, 9);
  if (data.change > 0) line(`Montant remboursé : ${fmt(data.change)} FCFA`, 9);
  y += 3;

  // Pied
  line('Merci de votre visite !', 12, true, 'center');
  line('Pour vous remercier, Family Store vous offre 5%', 8, false, 'center');
  line('de réduction sur votre prochain achat.', 8, false, 'center');
  line('Présentez simplement cette facture à la caisse', 7, false, 'center');
  line('pour bénéficier de cette offre.', 7, false, 'center');

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
