import { displayName } from '../utils/text';
import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import { t, dateLocale } from '../i18n';

// ── Barcode renderer ──────────────────────────────────────────────────────────
// Encodage Code39 partagé (utils/code39) : le MÊME code à l'écran et à
// l'impression — les barres imprimées étaient décoratives, illisibles à la
// douchette, alors que l'aperçu montrait un vrai code.
import { drawCode39, barresHtml, rectsCode39 } from '../utils/code39';
import { skuProduit } from '../utils/sku';

function BarcodeCanvas({ value, width = 200, height = 44 }: { value: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // width/height dans les dépendances : redimensionner un canvas l'EFFACE.
  // Au changement de format d'étiquette, les vignettes changeaient de taille
  // et tous les aperçus de codes-barres devenaient blancs.
  useEffect(() => {
    if (ref.current) drawCode39(ref.current, value);
  }, [value, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ display: 'block', imageRendering: 'pixelated' }}/>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// SKU partagé avec la caisse (utils/sku.ts) : ce que l'étiquette encode est
// exactement ce que `trouverParCode` sait retrouver au scan.
const skuOf = (p: Product): string => skuProduit(p);

// ── Impression Brother 62×29 : un PDF VECTORIEL, pas d'impression HTML ────────
// C'est la chaîne de l'étiquette de test VALIDÉE à la douchette : des
// rectangles jsPDF posés au millimètre, imprimés depuis la visionneuse PDF.
// L'impression HTML du navigateur rastérise et lisse des barres de 0,3 mm —
// sur le terrain, la douchette lisait le PDF de test et pas l'étiquette HTML.
async function imprimerPdfBrother(produits: Product[], enseigne: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [62, 29] });
  const num = (n: number) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  produits.forEach((p, i) => {
    if (i > 0) doc.addPage([62, 29], 'landscape');
    const sku  = skuOf(p);
    const code = sku.replace(/-/g, '').slice(0, 14);
    doc.setTextColor(0, 0, 0);
    const nom = displayName(p.name);
    // La QL-800 ne peut pas imprimer les ~2 premiers millimètres du rouleau :
    // le contenu démarre à 5,6 mm — la zone morte reste vide. Et le bas de
    // l'étiquette est REMONTÉ : glissée dans un porte-étiquette, la dernière
    // ligne (le prix) sortait cachée par le rail du support.
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(nom.length > 34 ? nom.slice(0, 33) + '…' : nom, 2, 5.6);
    // Barres : mêmes cotes que l'étiquette de test qui se scanne — zone
    // 4 → 58 mm, zones blanches de silence de chaque côté.
    doc.setFillColor(0, 0, 0);
    for (const r of rectsCode39(code, 4, 54)) doc.rect(r.x, 6.8, r.w, 9.2, 'F');
    doc.setFont('courier', 'bold'); doc.setFontSize(7);
    doc.text(sku, 31, 18.6, { align: 'center' });
    // Enseigne à gauche (petit, italique, gras) ; PRIX gros et lisible de loin.
    doc.setFont('helvetica', 'bolditalic'); doc.setFontSize(6.5);
    doc.text(enseigne, 2, 24.6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5);
    doc.text(`${num(p.price)} XAF`, 60, 25.0, { align: 'right' });
  });

  // Visionneuse PDF du navigateur — on imprime depuis là, exactement comme
  // l'étiquette de test. Fenêtre bloquée → le fichier se télécharge.
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (!win) doc.save(`etiquettes-brother_${new Date().toISOString().slice(0, 10)}.pdf`);
}

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';

function fmtN(n: number) { return n.toLocaleString(dateLocale()); }

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  search:  'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  print:   'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  check:   'M20 6L9 17l-5-5',
};

type Template = 'brother' | 'mini' | 'standard' | 'grande';
const TEMPLATES: { id: Template; label: string; size: string }[] = [
  // Rouleaux DK des étiqueteuses Brother QL (62 mm de large) — les autres
  // formats débordent de ce média, celui-ci est taillé pour.
  { id: 'brother',  label: 'Brother 62', size: '62×29 mm' },
  { id: 'mini',     label: 'Mini',     size: '57×32 mm' },
  { id: 'standard', label: 'Standard', size: '90×50 mm' },
  { id: 'grande',   label: t('Grande', 'Large'),   size: '100×70 mm' },
];

// ── Label card ────────────────────────────────────────────────────────────────

function LabelCard({ product, template, selected, onToggle }: {
  product: Product;
  template: Template;
  selected: boolean;
  onToggle: () => void;
}) {
  const sku   = skuOf(product);
  const color = catColor(product.category);
  const isLarge = template === 'grande';
  const isMini  = template === 'mini' || template === 'brother';   // compacts

  return (
    <div style={{
      background: '#fff', border: `2px solid ${selected ? 'var(--fs-wine-700)' : 'var(--fs-line)'}`,
      borderRadius: 10, padding: isMini ? '10px 12px' : isLarge ? '16px 18px' : '12px 14px',
      boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.15)' : 'var(--fs-shadow-sm)',
      cursor: 'pointer', position: 'relative',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }} onClick={onToggle}>
      {/* Checkbox */}
      <div style={{
        position: 'absolute', top: 10, right: 10,
        width: 18, height: 18, borderRadius: 4,
        border: selected ? '2px solid var(--fs-wine-700)' : '2px solid var(--fs-line-2)',
        background: selected ? 'var(--fs-wine-700)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        {selected && <I d={D.check} size={11}/>}
      </div>

      {/* Category strip */}
      <div style={{ height: 3, borderRadius: 2, background: color, marginBottom: 8 }}/>

      <div style={{ paddingRight: 24, marginBottom: 4 }}>
        <div style={{ fontSize: isMini ? 11 : isLarge ? 15 : 12, fontWeight: 700, color: 'var(--fs-ink-900)', lineHeight: 1.3 }}>
          {displayName(product.name)}
        </div>
        {product.localName && (
          <div style={{ fontSize: isMini ? 9 : 10, color: '#999', marginTop: 1, lineHeight: 1.2 }}>
            {product.localName}
          </div>
        )}
      </div>

      {!isMini && (
        <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          {product.category ?? t('Non classé', 'Uncategorized')}
        </div>
      )}

      {/* Barcode */}
      <div style={{ background: 'var(--fs-ivory)', borderRadius: 6, padding: '6px 8px', marginBottom: 8, textAlign: 'center', overflow: 'hidden' }}>
        <BarcodeCanvas value={sku.replace(/-/g, '')} width={isMini ? 160 : isLarge ? 220 : 190} height={isMini ? 28 : isLarge ? 48 : 36}/>
        <div style={{ fontSize: 9, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', marginTop: 3, letterSpacing: '0.1em' }}>{sku}</div>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>{t('PRIX DE VENTE', 'SELLING PRICE')}</div>}
          <div style={{ fontSize: isMini ? 14 : isLarge ? 20 : 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-800)' }}>
            {fmtN(product.price)} <span style={{ fontSize: isMini ? 9 : 11, fontWeight: 600 }}>XAF</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>{t('UNITÉ', 'UNIT')}</div>}
          <div style={{ fontSize: isMini ? 10 : 12, fontWeight: 700, color: 'var(--fs-ink-600)' }}>{product.unit}{product.valeur ? ` · ${product.valeur}` : ''}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksEtiquettes() {
  const { settings } = useSettings();
  const nomMagasin = settings.nomMagasin || 'Family Store';
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  // Brother 62 par défaut : c'est le format de l'étiqueteuse validée en
  // boutique — celui qu'on imprime réellement au quotidien.
  const [template,  setTemplate]  = useState<Template>('brother');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllProducts().then(setProducts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const displayed = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    skuOf(p).toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map(p => p._id)));
    }
  };

  const handleBatchPrint = async () => {
    const toPrint = products.filter(p => selected.has(p._id));
    if (toPrint.length === 0) return;

    // Brother : PDF vectoriel (la chaîne validée à la douchette), pas
    // d'impression HTML — voir imprimerPdfBrother.
    if (template === 'brother') {
      await imprimerPdfBrother(toPrint, nomMagasin);
      return;
    }

    const sizes: Record<Template, string> = { brother: '62mm 29mm', mini: '57mm 32mm', standard: '90mm 50mm', grande: '100mm 70mm' };
    const fontSizes: Record<Template, { name: number; price: number; sku: number }> = {
      brother:  { name: 10, price: 13, sku: 8 },
      mini:     { name: 11, price: 14, sku: 8 },
      standard: { name: 13, price: 18, sku: 9 },
      grande:   { name: 16, price: 24, sku: 10 },
    };
    const fs = fontSizes[template];
    // Hauteur des barres selon le format (le Brother, lui, passe par le PDF
    // vectoriel ci-dessus et n'arrive jamais ici).
    const barresMm: Record<Template, number> = { brother: 10, mini: 6, standard: 8, grande: 11 };
    const margeMm = 3;
    const compact = false;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head><title>${t(`Étiquettes — ${nomMagasin}`, `Labels — ${nomMagasin}`)}</title>
      <style>
        @page { size: ${sizes[template]}; margin: ${margeMm}mm; }
        /* Impression THERMIQUE : pas de gris — il sort pâle et flou. Tout le
           texte est en noir pur et appuyé, c'est l'encre qu'on lit en rayon. */
        body { margin: 0; font-family: Arial, sans-serif; color: #000; }
        .label { page-break-after: always; padding: 4px; }
        .strip { height: 3px; border-radius: 2px; margin-bottom: 6px; }
        .name  { font-size: ${fs.name}px; font-weight: 900; color: #000; margin-bottom: 1px; }
        .lname { font-size: ${Math.max(fs.name - 3, 8)}px; font-weight: 600; color: #000; margin-bottom: 3px; }
        .cat   { font-size: 8px; font-weight: 700; color: #000; text-transform: uppercase; margin-bottom: 6px; }
        .bc    { background: #fff; text-align: center; margin-bottom: 6px; }
        .sku   { font-size: ${fs.sku}px; font-family: monospace; font-weight: bold; color: #000; letter-spacing: 0.1em; }
        .price { font-size: ${fs.price}px; font-weight: 900; color: #000; }
        .row   { display: flex; justify-content: space-between; align-items: baseline; }
        .unit  { font-size: 10px; font-weight: 700; color: #000; }
        /* Le code-barres est un SVG (voir utils/code39) : du contenu, imprimé
           même sans « Graphiques d'arrière-plan ». Le conteneur ne fait que le
           dimensionner, avec 2 mm de zone blanche de chaque côté. */
        .bars  { height: ${barresMm[template]}mm; background: #fff; padding: 0 2mm; }
        /* Les fonds décoratifs (bande de catégorie, cartouche) suivent. */
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { background: none; } }
      </style></head>
      <body>
        ${toPrint.map(p => {
          const sku = skuOf(p);
          const col = catColor(p.category);
          // Le code encodé est le SKU sans tirets — celui que lit la douchette.
          const bars = barresHtml(sku.replace(/-/g, '').slice(0, 14));
          return `
            <div class="label">
              <div class="strip" style="background:${col}"></div>
              <div class="name">${displayName(p.name)}</div>
              ${!compact && p.localName ? `<div class="lname">${p.localName}</div>` : ''}
              ${compact ? '' : `<div class="cat">${p.category ?? ''}</div>`}
              <div class="bc">
                <div class="bars">${bars}</div>
                <div class="sku">${sku}</div>
              </div>
              <div class="row">
                <div class="price">${fmtN(p.price)} <span style="font-size:10px;font-weight:600">XAF</span></div>
                <div class="unit">${p.unit}${p.valeur ? ' · ' + p.valeur : ''}</div>
              </div>
            </div>
          `;
        }).join('')}
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Gestion de stock', 'Stock management')}</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{t('Étiquettes / SKU', 'Labels / SKU')}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: template === t.id ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: template === t.id ? 'var(--fs-wine-700)' : '#fff',
                  color: template === t.id ? '#fff' : 'var(--fs-ink-500)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>
                  {t.label} <span style={{ opacity: 0.7, fontSize: 10 }}>{t.size}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Rechercher…', 'Search…')}
                  style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 200 }}/>
              </div>
              {selected.size > 0 && (
                <button onClick={handleBatchPrint}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}>
                  <I d={D.print} size={13}/> {t('Imprimer', 'Print')} ({selected.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Select all bar */}
        {displayed.length > 0 && (
          <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '8px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-600)', fontFamily: 'var(--fs-font-sans)' }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, border: '2px solid var(--fs-wine-700)', background: selected.size === displayed.length ? 'var(--fs-wine-700)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                {selected.size === displayed.length && <I d={D.check} size={10}/>}
              </div>
              {t('Tout sélectionner', 'Select all')} ({displayed.length})
            </button>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, color: 'var(--fs-wine-700)', fontWeight: 600 }}>
                {selected.size} {t('étiquette(s) sélectionnée(s)', 'label(s) selected')}
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>{t('Chargement…', 'Loading…')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${template === 'mini' || template === 'brother' ? 200 : template === 'grande' ? 280 : 240}px, 1fr))`, gap: 14 }}>
              {displayed.map(p => (
                <LabelCard key={p._id} product={p} template={template} selected={selected.has(p._id)} onToggle={() => toggle(p._id)}/>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
