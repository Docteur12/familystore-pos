import React from 'react';
import {
  ReceiptData, buildReceiptHTML, doPrint, getPrintSettings, openCashDrawer,
} from './ReceiptPrint';
import { formatVolume } from '../utils/text';
import { OFFRE_DEFAULTS } from '../api/settings';

// Rend un texte marketing : les segments entre *astérisques* passent en gras.
function BoldText({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</>;
}

export type { ReceiptData } from './ReceiptPrint';

// Séparateur de milliers en espace ASCII (cohérent avec le ticket imprimé).
const f = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

interface Props {
  data:      ReceiptData;
  onNewSale: () => void;
}

export default function Receipt({ data, onNewSale }: Props) {
  const ps = getPrintSettings();

  // L'archive PDF de la facture est créée automatiquement à la validation de la
  // vente (Caisse) et à la synchro hors-ligne — plus besoin de l'archiver ici.
  const handlePrint = () => {
    const html = buildReceiptHTML(data);
    doPrint(html, ps.copies);
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
        maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
      }}>

        {/* Zone défilable : en-tête + corps du ticket */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 8px', textAlign: 'center', color: '#111' }}>
          <p style={{ fontWeight: 700, fontSize: 32, margin: 0, lineHeight: 1.05 }}>Family Store</p>
          <p style={{ fontSize: 12, letterSpacing: '0.12em', color: '#555', margin: '3px 0' }}>BY RDCT</p>
          <p style={{ fontSize: 13, color: '#333', margin: 0 }}>Beauté • Saveur • Bien-être</p>
        </div>

        {/* Corps */}
        <div style={{ padding: '0 24px 16px', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, color: '#111' }}>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Infos : meta (gauche) + contacts (droite) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              <div>Ticket : #{data.receiptNo}</div>
              <div>Date : {data.date.toLocaleDateString('fr-FR')} {data.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div>Caissier : {data.cashierName}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>Bonamoussadi – Douala</div>
              <div>Tél. : +237 694060524</div>
              <div>Tél. : +237 682634355</div>
            </div>
          </div>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Articles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
            {data.items.map((item, i) => {
              const hasDiscount = (item.discount ?? 0) > 0 && item.originalPrice;
              return (
                <div key={i}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>
                    {item.name}
                    {hasDiscount && (
                      <span style={{ background: '#c0392b', color: '#fff', fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>-{item.discount}%</span>
                    )}
                  </div>
                  {[formatVolume(item.valeur, item.unit), item.localName].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: 10, color: '#999' }}>{[formatVolume(item.valeur, item.unit), item.localName].filter(Boolean).join(' · ')}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginTop: 3 }}>
                    <span>
                      {hasDiscount && <span style={{ textDecoration: 'line-through', marginRight: 4 }}>{f(item.originalPrice!)}</span>}
                      {item.quantity} x {f(item.unitPrice)}
                    </span>
                    <span>{f(item.quantity * item.unitPrice)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ligne pointillée + sous-total/réductions : uniquement s'il y a une réduction */}
          {(totalDiscount > 0 || (data.offrePct ?? 0) > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
              <div style={{ borderTop: '1px dashed #000', margin: '0 0 8px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                <span>Sous-total</span>
                <span>{f(subDisplay)}</span>
              </div>
              {totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                  <span>Réduction produits</span>
                  <span>-{f(totalDiscount)}</span>
                </div>
              )}
              {(data.offrePct ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                  <span>Réduction facture -{data.offrePct}%</span>
                  <span>-{f(data.offreAmt ?? 0)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 26, color: '#111' }}>Total :</span>
            <span style={{ fontWeight: 700, fontSize: 26, color: '#111' }}>{f(data.total)} FCFA</span>
          </div>

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* Paiement */}
          <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>
            <div>Mode de paiement : {data.paymentLabel}</div>
            <div>Montant reçu : {f(data.amountPaid)} FCFA</div>
            {data.change > 0 && <div>Montant remboursé : {f(data.change)} FCFA</div>}
          </div>

          {/* Pied — textes marketing paramétrables (Admin → Paramètres) */}
          {(() => {
            const offre = { ...OFFRE_DEFAULTS, ...(data.offre ?? {}) };
            return (
              <div style={{ textAlign: 'center', marginTop: 14, color: '#111' }}>
                <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '0.04em' }}>Merci de votre visite !</div>
                {offre.titre.trim() && <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 5 }}><BoldText text={offre.titre}/></div>}
                {offre.message.trim() && <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: '#333' }}><BoldText text={offre.message}/></div>}
                {offre.validite.trim() && <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: '#333' }}><BoldText text={offre.validite}/></div>}
                {offre.cta.trim() && <div style={{ fontSize: 11, lineHeight: 1.45, marginTop: 4, color: '#333' }}><BoldText text={offre.cta}/></div>}
                <div style={{ fontSize: 10, lineHeight: 1.4, marginTop: 7, color: '#333' }}><strong>NB :</strong> Les articles achetés ou livrés ne sont ni échangés ni repris. Ils seront vérifiés et approuvés par le client.</div>
                {offre.salutation.trim() && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 7 }}><BoldText text={offre.salutation}/></div>}
              </div>
            );
          })()}
        </div>
        </div>{/* fin zone défilable */}

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
