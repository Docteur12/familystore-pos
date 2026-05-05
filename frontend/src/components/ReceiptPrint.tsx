// Utilitaires impression reçu thermique 80mm + gestion paramètres d'impression

export interface ReceiptItem {
  name:      string;
  unit:      string;
  quantity:  number;
  unitPrice: number;
}

export interface ReceiptData {
  receiptNo:    string;
  date:         Date;
  cashierName:  string;
  storePhone?:  string;
  items:        ReceiptItem[];
  total:        number;
  tva:          number;
  paymentLabel: string;
  amountPaid:   number;
  change:       number;
}

export interface PrintSettings {
  auto:    boolean;
  copies:  number;
  showTva: boolean;
}

export const PRINT_DEFAULTS: PrintSettings = {
  auto:    false,
  copies:  1,
  showTva: true,
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

export function buildReceiptHTML(data: ReceiptData, showTva = true): string {
  const dateStr = data.date.toLocaleDateString('fr-FR');
  const timeStr = data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const itemRows = data.items.map(item => {
    const sub = (item.quantity * item.unitPrice).toLocaleString('fr-FR');
    return `
    <div class="item">
      <div class="iname">${item.name}</div>
      <div class="irow">
        <span>${item.quantity} &times; ${item.unitPrice.toLocaleString('fr-FR')}</span>
        <span class="bold">${sub} XAF</span>
      </div>
    </div>`;
  }).join('');

  const tvaRow = showTva
    ? `<div class="row"><span>TVA incluse (19.25%)</span><span>${data.tva.toLocaleString('fr-FR')} XAF</span></div>`
    : '';

  const monnaieRow = data.change > 0
    ? `<div class="row bold"><span>Monnaie</span><span>${data.change.toLocaleString('fr-FR')} XAF</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Recu ${data.receiptNo}</title>
  <style>
    @media print {
      @page { size: 80mm auto; margin: 3mm 0; }
      body  { width: 80mm; margin: 0; }
      *     { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    * {
      margin: 0; padding: 0; box-sizing: border-box;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #000 !important;
    }
    body   { width: 80mm; margin: 0 auto; padding: 10px 12px 18px; background: #fff; }
    .center{ text-align: center; }
    .bold  { font-weight: bold; }
    .solid { border-top: 2px solid #000; margin: 7px 0; }
    .dash  { border-top: 1px dashed #000; margin: 6px 0; }
    .store { font-size: 19px; font-weight: 900; letter-spacing: 3px; }
    .sub   { font-size: 11px; margin: 2px 0; }
    .meta  { font-size: 12px; margin: 2px 0; }
    .item  { margin: 5px 0; }
    .iname { font-size: 13px; font-weight: 600; }
    .irow  { display: flex; justify-content: space-between; font-size: 12px; padding-left: 4px; }
    .row   { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; }
    .total { font-size: 16px; font-weight: 900; margin: 5px 0; }
    .foot  { font-size: 11px; margin: 2px 0; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store">FAMILY STORE</div>
    <div class="sub">by RDCT &mdash; Point de Vente</div>
    <div class="sub">Beaut&eacute; &middot; Saveurs &middot; Bien-&ecirc;tre</div>
    <div class="sub" style="margin-top:3px;font-weight:bold;">March&eacute; Bonamoussadi &middot; Douala</div>
    <div class="sub" style="font-weight:bold;">Tel: ${data.storePhone || '682 263 435'}</div>
  </div>
  <div class="solid"></div>
  <p class="meta">Ticket   : #${data.receiptNo}</p>
  <p class="meta">Date     : ${dateStr}  ${timeStr}</p>
  <p class="meta">Caissier : ${data.cashierName}</p>
  <div class="dash"></div>
  ${itemRows}
  <div class="dash"></div>
  <div class="row"><span>Sous-total</span><span>${data.total.toLocaleString('fr-FR')} XAF</span></div>
  ${tvaRow}
  <div class="row"><span>Remise</span><span>0 XAF</span></div>
  <div class="solid"></div>
  <div class="row total"><span>TOTAL</span><span>${data.total.toLocaleString('fr-FR')} XAF</span></div>
  <div class="solid"></div>
  <p class="meta">Paiement : ${data.paymentLabel}</p>
  <div class="row"><span>Re&ccedil;u</span><span>${data.amountPaid.toLocaleString('fr-FR')} XAF</span></div>
  ${monnaieRow}
  <div class="dash"></div>
  <div class="center">
    <p class="foot" style="font-weight:bold;">Merci de votre visite !</p>
    <p class="foot">Revenez nous voir — Family Store</p>
    <p class="foot" style="margin-top:5px;">March&eacute; Bonamoussadi &middot; Douala</p>
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
