import React from 'react';

interface ReceiptItem {
  name:      string;
  unit:      string;
  quantity:  number;
  unitPrice: number;
}

export interface ReceiptData {
  receiptNo:    string;
  date:         Date;
  items:        ReceiptItem[];
  total:        number;
  paymentLabel: string;
  amountPaid:   number;
  change:       number;
}

interface Props {
  data:       ReceiptData;
  onNewSale:  () => void;
}

// ── Générateur HTML reçu (impression 80mm) ────────────────────────────────────

function buildPrintHTML(data: ReceiptData): string {
  const dateStr  = data.date.toLocaleDateString('fr-FR');
  const timeStr  = data.date.toLocaleTimeString('fr-FR');
  const rows = data.items.map(item => `
    <tr>
      <td style="padding:3px 0">${item.name}</td>
      <td style="text-align:center;padding:3px 4px">${item.quantity}</td>
      <td style="text-align:right;padding:3px 0">${item.unitPrice.toLocaleString('fr-FR')}</td>
      <td style="text-align:right;padding:3px 0;font-weight:bold">
        ${(item.quantity * item.unitPrice).toLocaleString('fr-FR')}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Reçu ${data.receiptNo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      max-width: 300px;
      margin: 0 auto;
      padding: 12px 8px;
      color: #111;
    }
    .center { text-align: center; }
    .sep    { border-top: 1px dashed #555; margin: 8px 0; }
    h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
    .sub { font-size: 10px; color: #444; margin-top: 2px; }
    .meta { font-size: 11px; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase;
         border-bottom: 1px solid #000; padding-bottom: 4px; }
    th:nth-child(2) { text-align:center }
    th:nth-child(3), th:nth-child(4) { text-align:right }
    .total-row { display:flex; justify-content:space-between;
                 font-size:15px; font-weight:900; padding: 4px 0; }
    .pm { font-size:11px; margin-top:3px; }
    .footer { text-align:center; font-size:10px; color:#444; margin-top:4px; }
    @media print { @page { margin: 0; size: 80mm auto; } }
  </style>
</head>
<body>
  <div class="center">
    <h1>FAMILY STORE</h1>
    <p class="sub">by RDCT — Point de Vente</p>
    <p class="sub">Yaoundé, Cameroun</p>
  </div>
  <div class="sep"></div>
  <p class="meta">Date  : ${dateStr}</p>
  <p class="meta">Heure : ${timeStr}</p>
  <p class="meta">Reçu  : ${data.receiptNo}</p>
  <div class="sep"></div>
  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th>Qté</th>
        <th>P.U.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sep"></div>
  <div class="total-row">
    <span>TOTAL</span>
    <span>${data.total.toLocaleString('fr-FR')} FCFA</span>
  </div>
  <p class="pm">Paiement : ${data.paymentLabel}</p>
  <p class="pm">Reçu     : ${data.amountPaid.toLocaleString('fr-FR')} FCFA</p>
  ${data.change > 0 ? `<p class="pm" style="font-weight:bold;color:#555">Rendu    : ${data.change.toLocaleString('fr-FR')} FCFA</p>` : ''}
  <div class="sep"></div>
  <div class="footer">
    <p>✓ Merci pour votre achat !</p>
    <p>Revenez nous voir bientôt.</p>
    <p style="margin-top:8px;font-size:9px;color:#888">Family Store POS © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;
}

// ── Component modal reçu ─────────────────────────────────────────────────────

export default function Receipt({ data, onNewSale }: Props) {
  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=420,height=650');
    if (!w) { alert('Autorisez les popups pour imprimer.'); return; }
    w.document.write(buildPrintHTML(data));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
      flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header modal */}
        <div className="bg-bordeaux px-6 py-4 text-center">
          <p className="text-gold font-black text-lg tracking-widest">FAMILY STORE</p>
          <p className="text-cream/70 text-xs mt-0.5">by RDCT — Point de Vente</p>
        </div>

        {/* Corps du reçu */}
        <div className="px-6 py-4 font-mono text-sm">

          {/* Meta */}
          <div className="flex justify-between text-xs text-gray-400 mb-3">
            <span>{data.date.toLocaleDateString('fr-FR')}</span>
            <span>{data.date.toLocaleTimeString('fr-FR')}</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">N° {data.receiptNo}</p>

          <div className="border-t border-dashed border-gray-300 mb-3" />

          {/* Articles */}
          <div className="space-y-2 mb-3">
            {data.items.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-xs leading-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.quantity} × {item.unitPrice.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <span className="font-bold text-xs text-bordeaux shrink-0">
                  {(item.quantity * item.unitPrice).toLocaleString('fr-FR')}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-gray-300 mb-3" />

          {/* Total */}
          <div className="flex items-center justify-between mb-1">
            <span className="font-black text-gray-800">TOTAL</span>
            <span className="font-black text-bordeaux text-xl">
              {data.total.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
          <p className="text-xs text-gray-400">Paiement : {data.paymentLabel}</p>
          <p className="text-xs text-gray-400">
            Reçu : {data.amountPaid.toLocaleString('fr-FR')} FCFA
          </p>
          {data.change > 0 && (
            <p className="text-xs font-bold text-green-700 mt-0.5">
              Rendu : {data.change.toLocaleString('fr-FR')} FCFA
            </p>
          )}

          <div className="border-t border-dashed border-gray-300 mt-3 mb-3" />

          {/* Footer */}
          <p className="text-center text-xs text-gray-400">
            Merci pour votre achat !
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-3
              bg-bordeaux hover:bg-bordeaux-dark text-cream font-bold text-sm
              rounded-xl border-2 border-gold transition-colors"
          >
            <span>🖨️</span> Imprimer
          </button>
          <button
            onClick={onNewSale}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm
              font-bold text-gray-600 hover:bg-cream transition-colors"
          >
            Nouvelle vente
          </button>
        </div>
      </div>
    </div>
  );
}
