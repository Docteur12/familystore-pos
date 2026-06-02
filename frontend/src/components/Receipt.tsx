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
        <div style={{ background: 'var(--fs-wine-900)', padding: '16px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--fs-gold-400)', fontWeight: 900, fontSize: 18, letterSpacing: '0.15em', margin: '0 0 2px', fontFamily: 'var(--fs-font-mono)' }}>
            FAMILY STORE
          </p>
          <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 11, margin: '0 0 1px' }}>
            by RDCT
          </p>
          <p style={{ color: 'rgba(245,235,217,0.5)', fontSize: 10, margin: '0 0 1px' }}>
            Beauté · Saveurs · Bien-être
          </p>
          <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 11, fontWeight: 700, margin: '0 0 1px' }}>
            Point de Vente
          </p>
          <p style={{ color: 'rgba(245,235,217,0.45)', fontSize: 10, margin: 0 }}>
            Bonamoussadi · Douala &nbsp;|&nbsp; {data.storePhone || '682 263 435'}
          </p>
        </div>

        {/* Corps */}
        <div style={{ padding: '16px 24px', fontFamily: 'var(--fs-font-mono)', fontSize: 13 }}>

          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 4 }}>
            <span>{data.date.toLocaleDateString('fr-FR')}</span>
            <span>{data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fs-ink-400)', marginBottom: 2 }}>
            <span>N° {data.receiptNo}</span>
            <span>{data.cashierName}</span>
          </div>

          <div style={{ borderTop: '1px dashed var(--fs-line-2)', margin: '10px 0' }} />

          {/* Articles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {data.items.map((item, i) => {
              const hasDiscount = (item.discount ?? 0) > 0 && item.originalPrice;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontWeight: 600, color: 'var(--fs-ink-900)', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                          {hasDiscount && (
                            <span style={{ background: '#c0392b', color: '#fff', fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>
                              -{item.discount}%
                            </span>
                          )}
                        </p>
                        {item.localName && (
                          <p style={{ fontSize: 10, color: '#999', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.localName}
                          </p>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--fs-ink-400)', margin: 0 }}>
                      {hasDiscount && (
                        <span style={{ textDecoration: 'line-through', marginRight: 4 }}>
                          {item.originalPrice!.toLocaleString('fr-FR')}
                        </span>
                      )}
                      {item.quantity} × {item.unitPrice.toLocaleString('fr-FR')} XAF
                    </p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12, color: hasDiscount ? '#c0392b' : 'var(--fs-wine-700)', flexShrink: 0 }}>
                    {(item.quantity * item.unitPrice).toLocaleString('fr-FR')}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px dashed var(--fs-line-2)', margin: '10px 0' }} />

          {/* Totaux */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fs-ink-500)' }}>
              <span>Sous-total</span>
              <span>{subDisplay.toLocaleString('fr-FR')} XAF</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c0392b', fontWeight: 600 }}>
                <span>Réduction produits</span>
                <span>-{totalDiscount.toLocaleString('fr-FR')} XAF</span>
              </div>
            )}
            {(data.offrePct ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c0392b', fontWeight: 700 }}>
                <span>Réduction facture -{data.offrePct}%</span>
                <span>-{(data.offreAmt ?? 0).toLocaleString('fr-FR')} XAF</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--fs-ink-800)', letterSpacing: '0.05em' }}>TOTAL</span>
            <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--fs-wine-700)' }}>
              {data.total.toLocaleString('fr-FR')} <span style={{ fontSize: 13, fontWeight: 600 }}>XAF</span>
            </span>
          </div>

          {/* Paiement */}
          <div style={{ fontSize: 12, color: 'var(--fs-ink-500)', marginBottom: 2 }}>
            Paiement : {data.paymentLabel}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fs-ink-500)' }}>
            <span>Reçu</span>
            <span>{data.amountPaid.toLocaleString('fr-FR')} XAF</span>
          </div>
          {data.change > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
              <span>Monnaie</span>
              <span>{data.change.toLocaleString('fr-FR')} XAF</span>
            </div>
          )}

          <div style={{ borderTop: '1px dashed var(--fs-line-2)', margin: '10px 0 6px' }} />

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fs-ink-500)', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: 'var(--fs-ink-700)' }}>Merci pour votre achat</div>
            <div>Comme remerciement, <strong>Family Store vous offre 5 % de réduction</strong> sur votre prochain achat.</div>
            <div>Présentez juste cette facture à la caisse pour en bénéficier.</div>
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
