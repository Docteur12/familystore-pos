import React from 'react';
import {
  ReceiptData, buildReceiptHTML, buildReceiptPDF, doPrint, getPrintSettings, openCashDrawer,
} from './ReceiptPrint';
import { saveFacture } from '../api/factures';

export type { ReceiptData } from './ReceiptPrint';

interface Props {
  data:      ReceiptData;
  onNewSale: () => void;
}

export default function Receipt({ data, onNewSale }: Props) {
  const ps = getPrintSettings();

  const handlePrint = () => {
    const html = buildReceiptHTML(data);
    doPrint(html, ps.copies);
    // Archive PDF en arrière-plan (silencieux)
    try {
      const pdfBase64 = buildReceiptPDF(data);
      saveFacture({
        numero:        data.receiptNo,
        caissier:      data.cashierName,
        montant:       data.total,
        paymentMethod: data.paymentLabel,
        items:         data.items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        pdfBase64,
        date:          data.date.toISOString(),
      });
    } catch { /* silently ignore */ }
  };

  const subDisplay     = data.subtotal ?? data.total;
  const totalDiscount  = data.items.reduce((s, item) => {
    if ((item.discount ?? 0) > 0 && item.originalPrice) {
      return s + (item.originalPrice - item.unitPrice) * item.quantity;
    }
    return s;
  }, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        width: '100%', maxWidth: 380, overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 8px', textAlign: 'center', color: '#111' }}>
          <p style={{ fontWeight: 700, fontSize: 26, margin: 0 }}>Family Store</p>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', color: '#555', margin: '2px 0' }}>BY RDCT</p>
          <p style={{ fontSize: 12, color: '#333', margin: 0 }}>Beauté . Saveur . Bien-etre</p>
        </div>

        {/* Corps */}
        <div style={{ padding: '0 24px 16px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, color: '#111' }}>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Infos : meta (gauche) + contacts (droite) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: 1.5 }}>
            <div>
              <div>Ticket: #{data.receiptNo}</div>
              <div>Date: {data.date.toLocaleDateString('fr-FR')} {data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div>Caissier: {data.cashierName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Bonamoussadi – Douala</div>
              <div>Tel: +237 670792691</div>
              <div>Tel: +237 682263435</div>
            </div>
          </div>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Articles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
            {data.items.map((item, i) => {
              const hasDiscount = (item.discount ?? 0) > 0 && item.originalPrice;
              return (
                <div key={i}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                    {item.name}
                    {hasDiscount && (
                      <span style={{ background: '#c0392b', color: '#fff', fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>-{item.discount}%</span>
                    )}
                  </div>
                  {item.localName && <div style={{ fontSize: 10, color: '#999' }}>{item.localName}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginTop: 3 }}>
                    <span>
                      {hasDiscount && <span style={{ textDecoration: 'line-through', marginRight: 4 }}>{item.originalPrice!.toLocaleString('fr-FR')}</span>}
                      {item.quantity} x {item.unitPrice.toLocaleString('fr-FR')}
                    </span>
                    <span>{(item.quantity * item.unitPrice).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* Totaux (sous-total + réductions uniquement si réduction) */}
          {(totalDiscount > 0 || (data.offrePct ?? 0) > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                <span>Sous-total</span>
                <span>{subDisplay.toLocaleString('fr-FR')}</span>
              </div>
              {totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                  <span>Réduction produits</span>
                  <span>-{totalDiscount.toLocaleString('fr-FR')}</span>
                </div>
              )}
              {(data.offrePct ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                  <span>Réduction facture -{data.offrePct}%</span>
                  <span>-{(data.offreAmt ?? 0).toLocaleString('fr-FR')}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#111' }}>Total:</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#111' }}>{data.total.toLocaleString('fr-FR')} XFCA</span>
          </div>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Paiement */}
          <div style={{ fontSize: 11, color: '#333', lineHeight: 1.6 }}>
            <div>Moyen de paiement: {data.paymentLabel}</div>
            <div>Montant reçu: {data.amountPaid.toLocaleString('fr-FR')} Francs CFA</div>
            {data.change > 0 && <div>Montant remboursé: {data.change.toLocaleString('fr-FR')} Francs CFA</div>}
          </div>

          {/* Pied */}
          <div style={{ textAlign: 'center', marginTop: 14, color: '#111' }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.15em' }}>Merci de votre visite !</div>
            <div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 4, color: '#333' }}>
              Comme remerciement, <strong>Family Store vous offre 5 %</strong> de réduction sur votre prochain achat. Présentez juste cette facture à la caisse pour bénéficier de cette offre.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => { handlePrint(); openCashDrawer(); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '11px 0',
              background: 'var(--fs-wine-700)', color: '#fff',
              border: '2px solid var(--fs-gold-400)',
              borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--fs-font-sans)',
            }}
          >
            🖨️ Imprimer {ps.copies > 1 ? `×${ps.copies}` : ''}
          </button>
          <button
            onClick={onNewSale}
            style={{
              flex: 1, padding: '11px 0',
              border: '2px solid var(--fs-line-2)', borderRadius: 12,
              fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-600)',
              background: 'var(--fs-ivory)', cursor: 'pointer',
              fontFamily: 'var(--fs-font-sans)',
            }}
          >
            Nouvelle vente
          </button>
        </div>
      </div>
    </div>
  );
}
