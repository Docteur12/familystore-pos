import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, effectivePrice } from '../api/products';
import { displayName } from '../utils/text';
import { t, dateLocale } from '../i18n';

/**
 * Infobulle « fiche produit » : s'affiche au survol (ou au toucher) d'un nom de
 * produit dans un tableau et montre ses propriétés — fournisseur en tête,
 * puisque c'est la question la plus fréquente (« qui nous fournit ce produit ? »).
 *
 * Rendue via un portail sur <body> en position fixe : elle n'est donc jamais
 * rognée par un tableau ou un panneau en overflow hidden/auto.
 *
 * Usage : <ProductTooltip product={p}>{p.name}</ProductTooltip>
 * Si `product` est absent (ex. produit supprimé du catalogue), l'enfant est
 * rendu tel quel, sans infobulle.
 */

const fmt = (n: number) => n.toLocaleString(dateLocale());

interface Props {
  product?: Product | null;
  children: React.ReactNode;
  /** Élément englobant (span par défaut). */
  as?: 'span' | 'div';
  style?: React.CSSProperties;
}

const TIP_W = 260;
const MARGIN = 8;

export default function ProductTooltip({ product, children, as = 'span', style }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback(() => {
    if (!product || !anchorRef.current) return;
    if (hideTimer.current) { window.clearTimeout(hideTimer.current); hideTimer.current = null; }
    const r = anchorRef.current.getBoundingClientRect();
    // Horizontal : aligné sur le bord gauche du nom, ramené dans l'écran si besoin
    const x = Math.max(MARGIN, Math.min(r.left, window.innerWidth - TIP_W - MARGIN));
    // Vertical : au-dessus si la place manque en dessous
    const below = r.bottom + 220 < window.innerHeight;
    setPos({ x, y: below ? r.bottom + 6 : r.top - 6, below });
  }, [product]);

  const hide = useCallback(() => {
    hideTimer.current = window.setTimeout(() => setPos(null), 80);
  }, []);

  useEffect(() => () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); }, []);

  // Fermer au scroll (la position fixe deviendrait fausse)
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);

  const Tag = as as any;

  return (
    <>
      <Tag
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onTouchStart={show}
        tabIndex={product ? 0 : undefined}
        style={{ cursor: product ? 'help' : undefined, outline: 'none', ...style }}
        aria-describedby={product && pos ? `ptip-${product._id}` : undefined}
      >
        {children}
      </Tag>

      {product && pos && createPortal(
        <div
          id={`ptip-${product._id}`}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: 'fixed', left: pos.x, top: pos.y, width: TIP_W, zIndex: 9999,
            transform: pos.below ? 'none' : 'translateY(-100%)',
            background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10,
            boxShadow: 'var(--fs-shadow-md, 0 6px 24px rgba(0,0,0,.12))',
            padding: '10px 12px', fontFamily: 'var(--fs-font-sans)', fontSize: 12,
            color: 'var(--fs-ink-800)', pointerEvents: 'auto',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fs-ink-900)', marginBottom: 6, lineHeight: 1.3 }}>
            {displayName(product.name)}
            {product.localName && <span style={{ fontWeight: 400, color: 'var(--fs-ink-400)' }}> · {product.localName}</span>}
          </div>

          {/* Fournisseur mis en avant */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', marginBottom: 6, background: 'var(--fs-ivory)', borderRadius: 6 }}>
            <span style={{ color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{t('Fournisseur', 'Supplier')}</span>
            <span style={{ fontWeight: 700, color: product.fournisseur ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)', textAlign: 'right' }}>
              {product.fournisseur || t('Non renseigné', 'Not specified')}
            </span>
          </div>

          <Row label={t('Catégorie', 'Category')} value={[product.category, product.subCategory].filter(Boolean).join(' › ') || '—'} />
          <Row label={t('Code-barres', 'Barcode')} value={product.barcode || '—'} mono />
          <Row label={t('Prix de vente', 'Selling price')} value={`${fmt(effectivePrice(product))} XAF${product.discount ? ` (−${product.discount} %)` : ''}`} />
          <Row label={t("Prix d'achat", 'Purchase price')} value={`${fmt(product.costPrice)} XAF`} />
          <Row label={t('Stock caisse', 'Checkout stock')} value={`${fmt(product.stock)} ${product.unit || ''}`.trim()} warn={product.stock <= product.alertThreshold} />
          {product.stockMagazin !== undefined && (
            <Row label={t('Stock entrepôt', 'Warehouse stock')} value={`${fmt(product.stockMagazin)} ${product.unit || ''}`.trim()} />
          )}
          {product.valeur && <Row label={t('Contenance', 'Contents')} value={product.valeur} />}
          {product.expiryDate && <Row label={t('Péremption', 'Expiry')} value={new Date(product.expiryDate).toLocaleDateString(dateLocale())} />}
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({ label, value, mono, warn }: { label: string; value: string; mono?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '2px 0', borderTop: '1px solid var(--fs-line)' }}>
      <span style={{ color: 'var(--fs-ink-400)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', color: warn ? '#C2566B' : 'var(--fs-ink-800)', fontFamily: mono ? 'var(--fs-font-mono, monospace)' : undefined }}>{value}</span>
    </div>
  );
}
