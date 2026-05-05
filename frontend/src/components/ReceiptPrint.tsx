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
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; margin: 0; }
      * { font-family: monospace; font-size: 12px; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace; font-size: 12px; }
    body { width: 80mm; margin: 0 auto; padding: 6px 6px 14px; color: #000; }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .solid  { border-top: 1px solid #000; margin: 6px 0; }
    .dash   { border-top: 1px dashed #555; margin: 5px 0; }
    .store  { font-size: 16px; font-weight: 900; letter-spacing: 2px; }
    .meta   { font-size: 11px; margin: 2px 0; }
    .item   { margin: 4px 0; }
    .iname  { font-size: 12px; }
    .irow   { display: flex; justify-content: space-between; font-size: 11px; color: #333; }
    .row    { display: flex; justify-content: space-between; font-size: 12px; margin: 2px 0; }
    .total  { font-size: 15px; font-weight: 900; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="center">
    <div class="store">FAMILY STORE</div>
    <div class="meta">by RDCT</div>
    <div class="meta">Beaut&eacute; &middot; Saveurs &middot; Bien-&ecirc;tre</div>
    <div class="meta">Douala, Cameroun</div>
    <div class="meta">Tel: ${data.storePhone || '+237 XXX XXX XXX'}</div>
  </div>
  <div class="solid"></div>
  <p class="meta">Ticket   : #${data.receiptNo}</p>
  <p class="meta">Date     : ${dateStr} ${timeStr}</p>
  <p class="meta">Caissier : ${data.cashierName}</p>
  <div class="dash"></div>
  ${itemRows}
  <div class="dash"></div>
  <div class="row"><span>Sous-total</span><span>${data.total.toLocaleString('fr-FR')} XAF</span></div>
  ${tvaRow}
  <div class="row"><span>Remise</span><span>0 XAF</span></div>
  <div class="solid"></div>
  <div class="row total"><span>TOTAL</span><span>${data.total.toLocaleString('fr-FR')} XAF</span></div>
  <p class="meta">Paiement : ${data.paymentLabel}</p>
  <div class="row"><span>Re&ccedil;u</span><span>${data.amountPaid.toLocaleString('fr-FR')} XAF</span></div>
  ${monnaieRow}
  <div class="dash"></div>
  <div class="center">
    <p class="meta">Merci de votre visite</p>
    <p class="meta">Revenez nous voir !</p>
    <p style="font-size:9px;margin-top:8px;color:#666">Family Store POS &copy; ${new Date().getFullYear()}</p>
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
