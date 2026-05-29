import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getAllProducts, createProduct, updateProduct, getProductByBarcode, Product } from '../api/products';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import QRScanner from '../components/QRScanner';
import { useIsMobile }       from '../hooks/useIsMobile';
import AutocompleteInput     from '../components/AutocompleteInput';
import {
  createReception, getDemandes, marquerEnvoye, getHistorique, createEnvoi,
  DemandeStock, ReceptionRecord,
} from '../api/magazinier';
import { getFournisseurs } from '../api/fournisseurs';

// ── Icons ─────────────────────────────────────────────────────────────────────

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const D = {
  reception: 'M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  demande:   'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 1 1 2 2',
  history:   'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  check:     'M20 6L9 17l-5-5',
  logout:    'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  truck:     'M1 3h15v13H1zM16 8h4l3 3v5h-7V8z',
  scan:      'M23 7V1h-6M1 7V1h6M23 17v6h-6M1 17v6h6M4 12h2M9 12h2M14 12h2M19 12h2',
  pkg:       'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
  tag:       'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  print:     'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  search:    'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
};

// ── Code39 barcode renderer ───────────────────────────────────────────────────

const CODE39_MAP: Record<string, string> = {
  '0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101',
  '4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011',
  '8':'110100101101','9':'101100101101','A':'110101001011','B':'101101001011',
  'C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101',
  'G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101',
  'K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011',
  'O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001',
  'S':'101101011001','T':'101011011001','U':'110010101011','V':'100110101011',
  'W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101',
  '-':'100101011011','*':'100101101101',
};

function drawCode39(canvas: HTMLCanvasElement, text: string, barW = 1.5, h = 44) {
  const raw = ('*' + text.toUpperCase().replace(/[^0-9A-Z\-]/g, '') + '*')
    .split('').map(c => CODE39_MAP[c] ?? '').filter(Boolean).join('0');
  if (!raw) return;
  canvas.width  = Math.ceil(raw.length * barW);
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, h);
  ctx.fillStyle = '#1a1a1a';
  [...raw].forEach((bit, i) => {
    if (bit === '1') ctx.fillRect(Math.round(i * barW), 0, Math.ceil(barW), h);
  });
}

// ── BarcodeCanvas ─────────────────────────────────────────────────────────────

function BarcodeCanvas({ value, height = 44 }: { value: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawCode39(ref.current, value, 1.5, height); }, [value, height]);
  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'pixelated', maxWidth: '100%' }}/>;
}

// ── Étiquettes helpers ────────────────────────────────────────────────────────

function skuOf(p: { barcode?: string; _id: string }): string {
  if (p.barcode) return p.barcode;
  return p._id.slice(-9).toUpperCase().replace(/(.{3})/g, '$1-').slice(0, 11);
}

const CAT_COLORS: Record<string, string> = {
  'beauté': '#F5C4B2', 'hygiène': '#B8D8EC', 'parfumerie': '#D8C4E8',
  'épicerie': '#EDD8A0', 'boissons': '#B4DCC4', 'alimentation': '#F0D4B0',
  'bien-être': '#A8E0D4', 'maison': '#D4C8B8',
};
const catColor = (c?: string) => CAT_COLORS[c?.toLowerCase() ?? ''] ?? '#DDD4C8';
function fmtN(n: number) { return n.toLocaleString('fr-FR'); }

type EtiqTemplate = 'mini' | 'standard' | 'grande';
const ETIQ_TEMPLATES: { id: EtiqTemplate; label: string; size: string }[] = [
  { id: 'mini',     label: 'Mini',     size: '57×32 mm'  },
  { id: 'standard', label: 'Standard', size: '90×50 mm'  },
  { id: 'grande',   label: 'Grande',   size: '100×70 mm' },
];

function EtiqLabelCard({ product, template, selected, onToggle }: {
  product: Product; template: EtiqTemplate; selected: boolean; onToggle: () => void;
}) {
  const sku    = skuOf(product);
  const color  = catColor(product.category);
  const isLarge = template === 'grande';
  const isMini  = template === 'mini';

  return (
    <div style={{
      background: '#fff', borderRadius: 10, cursor: 'pointer',
      border: `2px solid ${selected ? 'var(--fs-wine-700)' : 'var(--fs-line)'}`,
      padding: isMini ? '10px 12px' : isLarge ? '16px 18px' : '12px 14px',
      boxShadow: selected ? '0 0 0 3px rgba(122,29,46,0.15)' : 'var(--fs-shadow-sm)',
      position: 'relative', transition: 'border-color 0.15s, box-shadow 0.15s',
    }} onClick={onToggle}>
      <div style={{
        position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: 4,
        border: selected ? '2px solid var(--fs-wine-700)' : '2px solid var(--fs-line-2)',
        background: selected ? 'var(--fs-wine-700)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}>
        {selected && <I d={D.check} size={11}/>}
      </div>
      <div style={{ height: 3, borderRadius: 2, background: color, marginBottom: 8 }}/>
      <div style={{ paddingRight: 24, marginBottom: 4 }}>
        <div style={{ fontSize: isMini ? 11 : isLarge ? 15 : 12, fontWeight: 700, color: 'var(--fs-ink-900)', lineHeight: 1.3 }}>
          {product.name}
        </div>
        {product.localName && (
          <div style={{ fontSize: isMini ? 9 : 10, color: '#999', marginTop: 1, lineHeight: 1.2 }}>
            {product.localName}
          </div>
        )}
      </div>
      {!isMini && (
        <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          {product.category ?? 'Non classé'}
        </div>
      )}
      <div style={{ background: 'var(--fs-ivory)', borderRadius: 6, padding: '6px 8px', marginBottom: 8, textAlign: 'center', overflow: 'hidden' }}>
        <BarcodeCanvas value={sku.replace(/-/g, '')} height={isMini ? 28 : isLarge ? 48 : 36}/>
        <div style={{ fontSize: 9, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)', marginTop: 3, letterSpacing: '0.1em' }}>{sku}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>PRIX DE VENTE</div>}
          <div style={{ fontSize: isMini ? 14 : isLarge ? 20 : 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-800)' }}>
            {fmtN(product.price)} <span style={{ fontSize: isMini ? 9 : 11, fontWeight: 600 }}>XAF</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {!isMini && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', fontWeight: 600, marginBottom: 1 }}>UNITÉ</div>}
          <div style={{ fontSize: isMini ? 10 : 12, fontWeight: 700, color: 'var(--fs-ink-600)' }}>
            {product.unit}{product.valeur ? ` · ${product.valeur}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)', background: '#fff',
};
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)',
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '9px 22px', background: 'var(--fs-wine-700)', color: '#fff',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const BTN_OUTLINE: React.CSSProperties = {
  padding: '7px 16px', background: '#fff', color: 'var(--fs-wine-700)',
  border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12,
  fontWeight: 700, cursor: 'pointer',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'receptions' | 'envois' | 'demandes' | 'historique' | 'dashboard' | 'etiquettes';

// ── Reception form row ────────────────────────────────────────────────────────

interface RecRow { productId: string; quantity: number | '' }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Magazinier() {
  const payload   = getTokenPayload();
  const isMobile  = useIsMobile();
  const { toasts, addToast, removeToast } = useToast();
  const [tab,       setTab]       = useState<Tab>('receptions');
  const [sideOpen,  setSideOpen]  = useState(false);

  // ── Product list ─────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const loadProducts = useCallback(() => getAllProducts().then(setProducts).catch(() => {}), []);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Fournisseurs (table centrale + historique des réceptions) ──────────────
  const [knownSuppliers, setKnownSuppliers] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([
      getFournisseurs().then(list => list.map(f => f.name)).catch(() => [] as string[]),
      getHistorique().then(h => h.receptions.map((r: ReceptionRecord) => r.fournisseur)).catch(() => [] as string[]),
    ]).then(([base, histo]) => {
      const unique = [...new Set([...base, ...histo].filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'fr'));
      setKnownSuppliers(unique);
    });
  }, []);

  // ── Nouveau produit inline ────────────────────────────────────────────────
  const NP_EMPTY = { name: '', barcode: '', category: '', subCategory: '', unit: 'unité', qty: '', seuilCommande: '', seuilAlerte: '5', expiryDate: '' };
  const [showNewProd,    setShowNewProd]    = useState(false);
  const [newProd,        setNewProd]        = useState({ ...NP_EMPTY });
  const [newProdLoading, setNewProdLoading] = useState(false);
  const setNP = (k: keyof typeof NP_EMPTY, v: string) => setNewProd(p => ({ ...p, [k]: v }));
  const newProdBarcodeRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (newProd.barcode && newProdBarcodeRef.current) drawCode39(newProdBarcodeRef.current, newProd.barcode);
  }, [newProd.barcode]);

  // Catégories et sous-catégories dérivées des produits existants
  const knownCategories    = [...new Set(['Beauté','Hygiène','Parfumerie','Épicerie','Boissons','Alimentation','Bien-être','Maison', ...products.map(p => p.category).filter(Boolean) as string[]])].sort((a, b) => a.localeCompare(b, 'fr'));
  const knownSubCategories = [...new Set(products.map(p => p.subCategory).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'));
  const UNITS = ['unité','kg','g','L','mL','pièce','boîte','sachet','bouteille'];

  // ── Scanner QR ─────────────────────────────────────────────────────────────
  const [scanTarget, setScanTarget] = useState<'newprod' | number | null>(null);

  const handleCreateProd = async () => {
    if (!newProd.name.trim()) { addToast('Le nom du produit est requis', 'error'); return; }
    setNewProdLoading(true);
    try {
      await createProduct({
        name:                newProd.name.trim().charAt(0).toUpperCase() + newProd.name.trim().slice(1),
        barcode:             newProd.barcode.trim() || undefined,
        category:            newProd.category || undefined,
        subCategory:         newProd.subCategory.trim() || undefined,
        unit:                newProd.unit || 'unité',
        price:               0,
        costPrice:           0,
        stock:               0,
        expiryDate:          newProd.expiryDate || null,
        magazinierThreshold: parseInt(newProd.seuilCommande) || 0,
      });
      await loadProducts();
      setShowNewProd(false);
      setNewProd({ ...NP_EMPTY });
      addToast('Produit créé ✓', 'success');
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
    finally { setNewProdLoading(false); }
  };

  // ── Dernière réception par produit ───────────────────────────────────────
  const [lastRecByProd, setLastRecByProd] = useState<Record<string, string>>({});
  useEffect(() => {
    getHistorique().then(h => {
      const map: Record<string, string> = {};
      [...h.receptions].reverse().forEach((r: ReceptionRecord) => {
        r.items?.forEach((it: any) => {
          const id = it.productId ?? it.product ?? it.product?._id;
          if (id && !map[id]) map[id] = r.createdAt;
        });
      });
      setLastRecByProd(map);
    }).catch(() => {});
  }, []);

  // ── Commander un produit depuis le catalogue ──────────────────────────────
  const commanderProduit = (product: Product) => {
    setRows([{ productId: product._id, quantity: Math.max(1, product.alertThreshold * 2) }]);
    setTab('receptions');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  // ── Reception form ────────────────────────────────────────────────────────
  const [fournisseur,  setFournisseur]  = useState('');
  const [note,         setNote]         = useState('');
  const [rows,         setRows]         = useState<RecRow[]>([{ productId: '', quantity: 1 }]);
  const [recLoading,   setRecLoading]   = useState(false);
  const [rowBarcodes,  setRowBarcodes]  = useState<string[]>(['']);
  const firstBarcodeRef = useRef<HTMLInputElement>(null);

  // Focus auto sur le champ code-barres quand l'onglet Réceptions s'affiche
  // (permet de scanner avec la douchette USB sans cliquer)
  useEffect(() => {
    if (tab === 'receptions') firstBarcodeRef.current?.focus();
  }, [tab]);

  const addRow    = useCallback(() => { setRows(r => [...r, { productId: '', quantity: 1 }]); setRowBarcodes(b => [...b, '']); }, []);
  const removeRow = useCallback((i: number) => { setRows(r => r.filter((_, n) => n !== i)); setRowBarcodes(b => b.filter((_, n) => n !== i)); }, []);
  const setRow    = useCallback((i: number, field: keyof RecRow, val: string | number) =>
    setRows(r => r.map((row, n) => n === i ? { ...row, [field]: val } : row)), []);
  const setRowBarcode = useCallback((i: number, v: string) =>
    setRowBarcodes(b => b.map((x, n) => n === i ? v : x)), []);

  const handleRowBarcodeSearch = useCallback(async (i: number, barcode: string) => {
    if (!barcode.trim()) return;
    try {
      const found = await getProductByBarcode(barcode.trim());
      setRow(i, 'productId', found._id);
    } catch {
      addToast('Produit introuvable pour ce code-barres', 'error');
    }
  }, [setRow, addToast]);

  // ── handleScan — défini après setRow ────────────────────────────────────────
  const handleScan = useCallback(async (code: string) => {
    setScanTarget(null);
    if (scanTarget === 'newprod') {
      setNP('barcode', code);
      try {
        const found = await getProductByBarcode(code);
        // Remplir tous les champs non-financiers
        setNewProd({
          name:          found.name,
          barcode:       found.barcode ?? code,
          category:      found.category ?? '',
          subCategory:   found.subCategory ?? '',
          unit:          found.unit ?? 'unité',
          qty:           String(found.stockMagazin ?? 0),
          seuilCommande: String(found.magazinierThreshold ?? 0),
          seuilAlerte:   String(found.alertThreshold ?? 5),
          expiryDate:    found.expiryDate ? found.expiryDate.slice(0, 10) : '',
        });
        addToast(`✓ Produit existant trouvé : ${found.name} — vérifiez et complétez`, 'success');
      } catch {
        addToast('Nouveau code-barres enregistré — remplissez les informations', 'info' as any);
      }
    } else if (typeof scanTarget === 'number') {
      try {
        const found = await getProductByBarcode(code);
        setRow(scanTarget, 'productId', found._id);
        setRowBarcode(scanTarget, code);
        addToast(`${found.name} sélectionné`, 'success');
      } catch {
        addToast('Produit introuvable pour ce code-barres', 'error');
      }
    }
  }, [scanTarget, addToast, setRow]);

  const handleValidateReception = useCallback(async () => {
    if (!fournisseur.trim()) { addToast('Indiquez le nom du fournisseur', 'error'); return; }
    const validRows = rows
      .map(r => ({ productId: r.productId, quantity: Number(r.quantity) || 0 }))
      .filter(r => r.productId && r.quantity > 0);
    if (validRows.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    setRecLoading(true);
    try {
      await createReception({ fournisseur: fournisseur.trim(), items: validRows, note });
      addToast(`Réception validée — ${validRows.length} produit(s) mis à jour`, 'success');
      setFournisseur(''); setNote(''); setRows([{ productId: '', quantity: 1 }]);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setRecLoading(false); }
  }, [fournisseur, rows, note, addToast]);

  // ── Envoi direct au gestionnaire ─────────────────────────────────────────
  interface EnvoiRow { produitId: string; quantite: number }
  const [envoiRows,    setEnvoiRows]    = useState<EnvoiRow[]>([{ produitId: '', quantite: 1 }]);
  const [envoiLoading, setEnvoiLoading] = useState(false);

  const warehouseProducts = products.filter(p => (p.stockMagazin ?? 0) > 0);

  const addEnvoiRow    = () => setEnvoiRows(r => [...r, { produitId: '', quantite: 1 }]);
  const removeEnvoiRow = (i: number) => setEnvoiRows(r => r.filter((_, n) => n !== i));
  const setEnvoiRow    = (i: number, field: keyof EnvoiRow, val: string | number) =>
    setEnvoiRows(r => r.map((row, n) => n === i ? { ...row, [field]: val } : row));

  const handleEnvoi = async () => {
    const valid = envoiRows.filter(r => r.produitId && r.quantite > 0);
    if (valid.length === 0) { addToast('Sélectionnez au moins un produit', 'error'); return; }
    setEnvoiLoading(true);
    try {
      await createEnvoi(valid);
      addToast(`${valid.length} produit(s) envoyé(s) au gestionnaire ✓`, 'success');
      setEnvoiRows([{ produitId: '', quantite: 1 }]);
      loadProducts();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setEnvoiLoading(false); }
  };

  // ── Demandes ──────────────────────────────────────────────────────────────
  const [demandes,    setDemandes]    = useState<DemandeStock[]>([]);
  const [dLoading,    setDLoading]    = useState(false);
  const [sending,     setSending]     = useState<string | null>(null);

  const loadDemandes = useCallback(async () => {
    setDLoading(true);
    try { setDemandes(await getDemandes()); }
    catch { addToast('Erreur chargement demandes', 'error'); }
    finally { setDLoading(false); }
  }, [addToast]);

  useEffect(() => { if (tab === 'demandes') loadDemandes(); }, [tab, loadDemandes]);

  const handleEnvoyer = useCallback(async (id: string) => {
    setSending(id);
    try {
      await marquerEnvoye(id);
      setDemandes(prev => prev.filter(d => d._id !== id));
      addToast('Marchandise marquée comme envoyée ✅', 'success');
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { setSending(null); }
  }, [addToast]);

  // ── Étiquettes ────────────────────────────────────────────────────────────
  const [etiqSearch,    setEtiqSearch]    = useState('');
  const [etiqTemplate,  setEtiqTemplate]  = useState<EtiqTemplate>('standard');
  const [etiqSelected,  setEtiqSelected]  = useState<Set<string>>(new Set());

  const etiqDisplayed = products.filter(p =>
    !etiqSearch ||
    p.name.toLowerCase().includes(etiqSearch.toLowerCase()) ||
    skuOf(p).toLowerCase().includes(etiqSearch.toLowerCase())
  );

  const etiqToggle = (id: string) => setEtiqSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const etiqToggleAll = () => {
    if (etiqSelected.size === etiqDisplayed.length) setEtiqSelected(new Set());
    else setEtiqSelected(new Set(etiqDisplayed.map(p => p._id)));
  };

  const handleEtiqPrint = () => {
    const toPrint = products.filter(p => etiqSelected.has(p._id));
    if (toPrint.length === 0) return;
    const sizes: Record<EtiqTemplate, string> = { mini: '57mm 32mm', standard: '90mm 50mm', grande: '100mm 70mm' };
    const fontSizes: Record<EtiqTemplate, { name: number; price: number; sku: number }> = {
      mini: { name: 11, price: 14, sku: 8 }, standard: { name: 13, price: 18, sku: 9 }, grande: { name: 16, price: 24, sku: 10 },
    };
    const fs = fontSizes[etiqTemplate];
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<html><head><title>Étiquettes — Family Store</title>
      <style>
        @page { size: ${sizes[etiqTemplate]}; margin: 3mm; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .label { page-break-after: always; padding: 4px; }
        .strip { height: 3px; border-radius: 2px; margin-bottom: 6px; }
        .name  { font-size: ${fs.name}px; font-weight: bold; margin-bottom: 1px; }
        .lname { font-size: ${Math.max(fs.name - 3, 8)}px; color: #999; margin-bottom: 3px; }
        .cat   { font-size: 8px; color: #999; text-transform: uppercase; margin-bottom: 6px; }
        .bc    { background: #f5f5f0; border-radius: 4px; padding: 4px; text-align: center; margin-bottom: 6px; }
        .sku   { font-size: ${fs.sku}px; font-family: monospace; letter-spacing: 0.1em; }
        .price { font-size: ${fs.price}px; font-weight: 900; color: #7a1d2e; }
        .row   { display: flex; justify-content: space-between; align-items: baseline; }
        .unit  { font-size: 10px; color: #666; }
        .bars  { display: flex; align-items: flex-end; justify-content: center; gap: 1px; height: ${etiqTemplate === 'mini' ? 20 : etiqTemplate === 'grande' ? 32 : 26}px; }
        .bar   { background: #111; border-radius: 0.5px; }
        @media print { body { background: none; } }
      </style></head><body>
      ${toPrint.map(p => {
        const sku = skuOf(p);
        const col = catColor(p.category);
        const chars = sku.replace(/-/g, '').slice(0, 14);
        const bars = chars.split('').map(c => {
          const w = c.charCodeAt(0) % 2 === 0 ? 3 : 1.5;
          const h = 60 + (c.charCodeAt(0) % 40);
          return `<div class="bar" style="width:${w}px;height:${h}%"></div>`;
        }).join('');
        return `<div class="label">
          <div class="strip" style="background:${col}"></div>
          <div class="name">${p.name}</div>
          ${p.localName ? `<div class="lname">${p.localName}</div>` : ''}
          <div class="cat">${p.category ?? ''}</div>
          <div class="bc"><div class="bars">${bars}</div><div class="sku">${sku}</div></div>
          <div class="row">
            <div class="price">${fmtN(p.price)} <span style="font-size:10px;font-weight:600">XAF</span></div>
            <div class="unit">${p.unit}${p.valeur ? ' · ' + p.valeur : ''}</div>
          </div></div>`;
      }).join('')}
      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── Historique ────────────────────────────────────────────────────────────
  const [histo,    setHisto]    = useState<{ receptions: ReceptionRecord[]; envois: DemandeStock[] } | null>(null);
  const [hLoading, setHLoading] = useState(false);

  useEffect(() => {
    if ((tab !== 'historique' && tab !== 'dashboard') || histo) return;
    setHLoading(true);
    getHistorique().then(setHisto).catch(() => addToast('Erreur chargement historique', 'error')).finally(() => setHLoading(false));
  }, [tab, histo, addToast]);

  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  // ── Tabs config ───────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'receptions', label: 'Réceptions',             icon: D.reception },
    { key: 'envois',     label: 'Envoyer au gestionnaire', icon: D.truck     },
    { key: 'demandes',   label: 'Demandes en attente',    icon: D.demande   },
    { key: 'historique', label: 'Historique',              icon: D.history   },
    { key: 'dashboard',  label: 'Tableau de bord',         icon: D.pkg       },
    { key: 'etiquettes', label: 'Étiquettes',              icon: D.tag       },
  ];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      {/* ── QR Scanner overlay ───────────────────────────────────────────── */}
      {scanTarget !== null && (
        <QRScanner
          onDetected={handleScan}
          onClose={() => setScanTarget(null)}
        />
      )}

      {/* ── Bouton hamburger mobile ──────────────────────────────────────── */}
      {isMobile && (
        <button onClick={() => setSideOpen(o => !o)} style={{
          position: 'fixed', top: 12, left: sideOpen ? 212 : 12, zIndex: 201,
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--fs-wine-900)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'left 0.25s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--fs-gold-400)" strokeWidth="2" strokeLinecap="round">
            {sideOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      )}

      {/* Overlay mobile */}
      {isMobile && sideOpen && (
        <div onClick={() => setSideOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.4)' }}/>
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 200, height: '100vh', background: 'var(--fs-wine-900)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        ...(isMobile ? {
          position: 'fixed', top: 0, left: sideOpen ? 0 : -216,
          zIndex: 200, transition: 'left 0.25s',
          boxShadow: sideOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        } : {}),
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 4 }}>Family Store</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Magazinier</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSideOpen(false); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', marginBottom: 2, borderRadius: 8, border: 'none',
              background: tab === t.key ? 'var(--fs-wine-700)' : 'transparent',
              borderLeft: tab === t.key ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              color: tab === t.key ? '#fff' : 'rgba(245,235,217,0.65)',
              cursor: 'pointer', textAlign: 'left', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400, fontFamily: 'var(--fs-font-sans)',
            }}>
              <span style={{ color: tab === t.key ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)', flexShrink: 0 }}>
                <I d={t.icon} size={15}/>
              </span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name?.split(' ')[0] ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>Magazinier</div>
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', padding: 2 }} title="Déconnexion">
            <I d={D.logout} size={14}/>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isMobile ? '12px 14px 12px 58px' : '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Espace Magazinier</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>
            {TABS.find(t => t.key === tab)?.label}
          </h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 1 — RÉCEPTIONS
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'receptions' && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 24, boxShadow: 'var(--fs-shadow-sm)' }}>

                {/* Fournisseur avec autocomplete */}
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Fournisseur</label>
                  <input
                    list="suppliers-list"
                    style={INPUT} value={fournisseur}
                    onChange={e => setFournisseur(e.target.value)}
                    placeholder="Nom du fournisseur ou sélectionner…"
                  />
                  <datalist id="suppliers-list">
                    {knownSuppliers.map(s => <option key={s} value={s}/>)}
                  </datalist>
                  {knownSuppliers.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {knownSuppliers.slice(0, 5).map(s => (
                        <button key={s} type="button" onClick={() => setFournisseur(s)}
                          style={{ padding: '3px 10px', border: '1px solid var(--fs-line-2)', borderRadius: 20, fontSize: 11, background: fournisseur === s ? 'var(--fs-wine-700)' : '#fff', color: fournisseur === s ? '#fff' : 'var(--fs-ink-600)', cursor: 'pointer' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Produits reçus */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ ...LABEL, marginBottom: 0 }}>Produits reçus</label>
                    <button type="button" onClick={() => setShowNewProd(v => !v)}
                      style={{ ...BTN_OUTLINE, fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <I d={D.plus} size={11}/> {showNewProd ? 'Annuler' : 'Nouveau produit'}
                    </button>
                  </div>

                  {/* Mini formulaire nouveau produit */}
                  {showNewProd && (
                    <div style={{ background: '#f8faf7', border: '1.5px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Nouveau produit</p>
                        <p style={{ fontSize: 10, color: 'var(--fs-ink-400)', margin: 0 }}>Prix complété par l'administrateur</p>
                      </div>

                      {/* Code-barres / QR — scan en premier */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input style={{ ...INPUT, fontFamily: 'var(--fs-font-mono)', flex: 1 }}
                          value={newProd.barcode} onChange={e => setNP('barcode', e.target.value)}
                          placeholder="Code-barres / QR (scan pour auto-remplir)"/>
                        <button type="button" onClick={() => setScanTarget('newprod')}
                          style={{ padding: '0 12px', border: '1.5px solid #86efac', borderRadius: 8, background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          <I d={D.scan} size={14}/> Scanner QR
                        </button>
                        <button type="button"
                          onClick={() => setNP('barcode', 'FS' + String(Date.now() % 10000000000).padStart(10, '0'))}
                          style={{ padding: '0 12px', border: '1.5px solid #86efac', borderRadius: 8, background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          🎲 Générer
                        </button>
                      </div>
                      {newProd.barcode && (
                        <div style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--fs-ivory)', borderRadius: 8, border: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
                          <canvas ref={newProdBarcodeRef} style={{ height: 44, imageRendering: 'pixelated' }}/>
                          <span style={{ fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)', fontWeight: 600 }}>{newProd.barcode}</span>
                        </div>
                      )}

                      {/* Nom */}
                      <div style={{ marginBottom: 8 }}>
                        <input style={INPUT} value={newProd.name} onChange={e => setNP('name', e.target.value)} placeholder="Nom du produit *" autoFocus={!newProd.barcode}/>
                      </div>

                      {/* Catégorie + Sous-catégorie */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <AutocompleteInput
                          value={newProd.category}
                          onChange={v => setNP('category', v)}
                          suggestions={knownCategories}
                          placeholder="Catégorie…"
                        />
                        <AutocompleteInput
                          value={newProd.subCategory}
                          onChange={v => setNP('subCategory', v)}
                          suggestions={knownSubCategories}
                          placeholder="Sous-catégorie…"
                        />
                      </div>

                      {/* Unité + Seuil alerte admin */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <select style={{ ...INPUT, background: '#fff', cursor: 'pointer' }} value={newProd.unit} onChange={e => setNP('unit', e.target.value)}>
                          {UNITS.map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input style={{ ...INPUT, textAlign: 'center' }} type="number" min={0} value={newProd.seuilAlerte} onChange={e => setNP('seuilAlerte', e.target.value)} placeholder="Seuil alerte" title="Seuil d'alerte stock (gestionnaire)"/>
                      </div>

                      {/* Quantité entrepôt + Seuil commande + Date péremption */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                        <input style={{ ...INPUT, textAlign: 'center' }} type="number" min={0} value={newProd.qty} onChange={e => setNP('qty', e.target.value)} placeholder="Qté reçue"/>
                        <input style={{ ...INPUT, textAlign: 'center' }} type="number" min={0} value={newProd.seuilCommande} onChange={e => setNP('seuilCommande', e.target.value)} placeholder="Seuil commande" title="Seuil pour déclencher une commande"/>
                        <input style={INPUT} type="date" value={newProd.expiryDate} onChange={e => setNP('expiryDate', e.target.value)} title="Date de péremption"/>
                      </div>
                      <button onClick={handleCreateProd} disabled={newProdLoading}
                        style={{ ...BTN_PRIMARY, fontSize: 12, padding: '8px 16px', opacity: newProdLoading ? 0.7 : 1 }}>
                        {newProdLoading ? 'Création…' : '✓ Créer le produit'}
                      </button>
                    </div>
                  )}

                  {rows.map((row, i) => {
                    const prod  = products.find(p => p._id === row.productId);
                    const sku   = prod ? skuOf(prod) : '';
                    const seuil = prod?.magazinierThreshold ?? 0;
                    return (
                      <div key={i} style={{ marginBottom: 12, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 12px' }}>

                        {/* Ligne 1 : code-barres + scan */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <input
                            ref={i === 0 ? firstBarcodeRef : undefined}
                            type="text"
                            value={rowBarcodes[i] ?? ''}
                            onChange={e => setRowBarcode(i, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRowBarcodeSearch(i, rowBarcodes[i] ?? ''); } }}
                            onBlur={() => { if ((rowBarcodes[i] ?? '').trim()) handleRowBarcodeSearch(i, rowBarcodes[i]!); }}
                            placeholder="Scanner ou saisir le code-barres…"
                            style={{ ...INPUT, fontFamily: 'var(--fs-font-mono)', fontSize: 12, flex: 1 }}
                          />
                          <button type="button" onClick={() => setScanTarget(i)} title="Scanner avec caméra"
                            style={{ padding: '0 12px', border: '1.5px solid #86efac', borderRadius: 8, background: '#f0fdf4', cursor: 'pointer', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            <I d={D.scan} size={14}/> Scanner
                          </button>
                        </div>

                        {/* Ligne 2 : dropdown + quantité + supprimer */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 36px', gap: 6 }}>
                          <select value={row.productId} onChange={e => setRow(i, 'productId', e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                            <option value="">— Choisir un produit —</option>
                            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                          </select>
                          <input type="number" min={0} value={row.quantity}
                            onChange={e => { const v = e.target.value; setRow(i, 'quantity', v === '' ? '' : (parseInt(v, 10) || 0)); }}
                            style={{ ...INPUT, textAlign: 'center' }} placeholder="Qté"/>
                          <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                            style={{ padding: '8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <I d={D.trash} size={13}/>
                          </button>
                        </div>

                        {/* Carte produit (si sélectionné) */}
                        {prod && (
                          <div style={{ marginTop: 8, background: '#f8faf7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            {/* Barcode canvas */}
                            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                              <BarcodeCanvas value={sku.replace(/-/g, '')} height={36}/>
                              <div style={{ fontSize: 9, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)', marginTop: 2, letterSpacing: '0.08em' }}>{sku}</div>
                            </div>
                            {/* Info produit */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', lineHeight: 1.3 }}>{prod.name}</div>
                              {prod.localName && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{prod.localName}</div>}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {prod.category && (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '2px 7px', color: 'var(--fs-ink-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    {prod.category}
                                  </span>
                                )}
                                <span style={{ fontSize: 10, fontWeight: 700, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '2px 7px', color: '#16a34a' }}>
                                  {prod.unit}{prod.valeur ? ` · ${prod.valeur}` : ''}
                                </span>
                              </div>
                              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                                Entrepôt : <strong style={{ color: 'var(--fs-ink-800)' }}>{prod.stockMagazin ?? 0}</strong>
                                &nbsp;·&nbsp; Caisse : <strong style={{ color: 'var(--fs-ink-600)' }}>{prod.stock}</strong>
                                {seuil > 0 && <>&nbsp;·&nbsp; Seuil commande : <strong>{seuil}</strong></>}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button onClick={addRow} style={{ ...BTN_OUTLINE, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <I d={D.plus} size={13}/> Ajouter une ligne
                  </button>
                </div>

                {/* Note */}
                <div style={{ marginTop: 16, marginBottom: 20 }}>
                  <label style={LABEL}>Note (optionnel)</label>
                  <input style={INPUT} value={note} onChange={e => setNote(e.target.value)} placeholder="Bon de livraison n°..."/>
                </div>

                <button onClick={handleValidateReception} disabled={recLoading} style={{ ...BTN_PRIMARY, opacity: recLoading ? 0.7 : 1 }}>
                  {recLoading ? 'Enregistrement…' : 'Valider la réception'}
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 2 — ENVOYER AU GESTIONNAIRE (envoi direct)
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'envois' && (
            <div style={{ maxWidth: 640 }}>
              {/* Bannière info */}
              <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <I d={D.truck} size={16}/>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Envoi direct au gestionnaire de stock</div>
                  <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>
                    Sélectionnez les produits à envoyer depuis votre entrepôt. Le gestionnaire verra apparaître la livraison et confirmera la réception.
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 24, boxShadow: 'var(--fs-shadow-sm)' }}>
                {warehouseProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                    <I d={D.pkg} size={32}/><br/><br/>
                    Aucun produit disponible en entrepôt — enregistrez d'abord une réception.
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <label style={LABEL}>Produits à envoyer</label>
                    </div>

                    {envoiRows.map((row, i) => {
                      const prod = products.find(p => p._id === row.produitId);
                      const maxQte = prod ? (prod.stockMagazin ?? 0) : 999;
                      return (
                        <div key={i} style={{ marginBottom: 10, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 36px', gap: 6 }}>
                            <select
                              value={row.produitId}
                              onChange={e => setEnvoiRow(i, 'produitId', e.target.value)}
                              style={{ ...INPUT, cursor: 'pointer' }}
                            >
                              <option value="">— Choisir un produit —</option>
                              {warehouseProducts.map(p => (
                                <option key={p._id} value={p._id}>
                                  {p.name} (entrepôt : {p.stockMagazin ?? 0})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number" min={1} max={maxQte}
                              value={row.quantite}
                              onChange={e => setEnvoiRow(i, 'quantite', Math.min(maxQte, parseInt(e.target.value) || 1))}
                              style={{ ...INPUT, textAlign: 'center' }}
                              placeholder="Qté"
                            />
                            <button onClick={() => removeEnvoiRow(i)} disabled={envoiRows.length === 1}
                              style={{ padding: '8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: envoiRows.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <I d={D.trash} size={13}/>
                            </button>
                          </div>
                          {prod && (
                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fs-ink-400)' }}>
                              Disponible en entrepôt : <strong style={{ color: row.quantite > maxQte ? '#dc2626' : 'var(--fs-ink-700)' }}>{maxQte}</strong>
                              {prod.category && <> · {prod.category}</>}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button onClick={addEnvoiRow} style={{ ...BTN_OUTLINE, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                      <I d={D.plus} size={13}/> Ajouter un produit
                    </button>

                    <button onClick={handleEnvoi} disabled={envoiLoading}
                      style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 8, opacity: envoiLoading ? 0.7 : 1 }}>
                      <I d={D.truck} size={14}/>
                      {envoiLoading ? 'Envoi en cours…' : 'Envoyer au gestionnaire de stock'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 3 — DEMANDES EN ATTENTE
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'demandes' && (
            <div style={{ maxWidth: 640 }}>
              {dLoading ? (
                <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
              ) : demandes.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                  <I d={D.check} size={32}/><br/>Aucune demande en attente
                </div>
              ) : demandes.map(d => (
                <div key={d._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', marginBottom: 10, boxShadow: 'var(--fs-shadow-sm)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <I d={D.pkg} size={18}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.produit?.name ?? '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                      {d.quantiteDemandee} demandé(s) · par {d.demandePar?.name ?? '?'} · {fmtDate(d.createdAt)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-300)', marginTop: 1 }}>
                      Stock actuel : {d.produit?.stock ?? '?'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEnvoyer(d._id)}
                    disabled={sending === d._id}
                    style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: sending === d._id ? 0.7 : 1 }}
                  >
                    <I d={D.truck} size={13}/>
                    {sending === d._id ? 'Envoi…' : 'Marquer comme envoyé'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 3 — HISTORIQUE
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'historique' && (
            <div style={{ maxWidth: 740 }}>
              {hLoading ? (
                <div style={{ color: 'var(--fs-ink-400)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Chargement…</div>
              ) : (
                <>
                  {/* Réceptions */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    Mes réceptions
                  </p>
                  {(histo?.receptions ?? []).length === 0 ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13, marginBottom: 24 }}>Aucune réception enregistrée</div>
                  ) : (histo?.receptions ?? []).map(r => (
                    <div key={r._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                            <I d={D.truck} size={13}/> {r.fournisseur}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                            {r.items.length} article(s) · {fmtDate(r.createdAt)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '3px 10px', borderRadius: 20 }}>
                          Reçu
                        </span>
                      </div>
                      {r.items.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {r.items.map((item, i) => (
                            <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '3px 8px', color: 'var(--fs-ink-700)' }}>
                              {item.productName} × {item.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Envois */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 10px' }}>
                    Mes envois
                  </p>
                  {(histo?.envois ?? []).length === 0 ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun envoi enregistré</div>
                  ) : (histo?.envois ?? []).map(e => (
                    <div key={e._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '14px 18px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{e.produit?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>
                          {e.quantiteDemandee} {e.produit?.unit ?? 'u.'} · demandé par {e.demandePar?.name ?? '?'} · envoyé le {e.dateEnvoi ? fmtDate(e.dateEnvoi) : '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '3px 10px', borderRadius: 20 }}>
                        Envoyé
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 4 — TABLEAU DE BORD MAGAZINIER
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'dashboard' && (() => {
            // Uniquement les produits que le magazinier a déjà reçus
            const mesProduits = products.filter(p => lastRecByProd[p._id]);
            return (
            <div style={{ maxWidth: 600 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fs-line)' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                    Mes produits — {mesProduits.length} référence{mesProduits.length !== 1 ? 's' : ''}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fs-ink-400)' }}>Produits que vous avez déjà réceptionnés</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--fs-ivory)' }}>
                      {['Produit', 'Quantité', 'Seuil commande'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>
                          {h}
                          {h === 'Seuil commande' && <div style={{ fontWeight: 400, textTransform: 'none', fontSize: 9, letterSpacing: 0, marginTop: 1 }}>Cliquer pour modifier</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mesProduits.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-300)', fontStyle: 'italic' }}>
                          Aucune réception enregistrée — validez une réception pour voir vos produits ici
                        </td>
                      </tr>
                    ) : mesProduits.map((p, i) => {
                      const seuil      = p.magazinierThreshold ?? 0;
                      const qteEntrepot = p.stockMagazin ?? 0;
                      const bas         = seuil > 0 && qteEntrepot <= seuil;
                      return (
                        <tr key={p._id} style={{ borderBottom: '1px solid var(--fs-line)', background: bas ? '#fef9f9' : i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              {p.name}
                              {bas && <span style={{ fontSize: 10, background: '#dc2626', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>À commander</span>}
                              {p.category && <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 400 }}>{p.category}</span>}
                            </div>
                            {p.stockMagazinAjuste && (
                              <div style={{ marginTop: 3, fontSize: 10, color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Quantité modifiée par l'administrateur
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, fontSize: 20, fontFamily: 'var(--fs-font-mono)', color: bas ? '#dc2626' : 'var(--fs-wine-700)' }}>
                            {qteEntrepot}
                          </td>
                          <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                            <input
                              type="number" min={0}
                              defaultValue={seuil}
                              placeholder="0"
                              onBlur={e => {
                                const v = parseInt(e.target.value) || 0;
                                if (v !== seuil) {
                                  updateProduct(p._id, { magazinierThreshold: v })
                                    .then(loadProducts)
                                    .catch(() => addToast('Erreur mise à jour seuil', 'error'));
                                }
                              }}
                              style={{ width: 64, padding: '5px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, fontSize: 13, textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: seuil > 0 ? 'var(--fs-ink-800)' : 'var(--fs-ink-300)', background: seuil > 0 ? '#fff' : 'var(--fs-ivory)' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Produits envoyés au gestionnaire — toujours visible */}
              {histo && (
                <div style={{ marginTop: 20, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <I d={D.truck} size={14}/>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                      Produits envoyés au gestionnaire
                    </p>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 20, padding: '2px 10px', color: 'var(--fs-ink-500)' }}>
                      {(histo.envois ?? []).length} envoi{(histo.envois ?? []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {(histo.envois ?? []).length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, fontStyle: 'italic' }}>
                      Aucun produit encore envoyé au gestionnaire
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--fs-ivory)' }}>
                          {['Produit', 'Qté envoyée', 'Stock entrepôt', 'Statut', 'Date'].map((h, i) => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(histo.envois as any[]).slice(0, 10).map((e: any, i: number) => {
                          const produit = products.find(p => p._id === (e.produit?._id ?? e.produit));
                          return (
                            <tr key={e._id} style={{ borderBottom: '1px solid var(--fs-line)', background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                              <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>
                                {e.produit?.name ?? '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>
                                {e.quantiteDemandee}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>
                                {produit ? (produit.stockMagazin ?? 0) : '—'}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: e.statut === 'reçu' ? '#f0fdf4' : '#eff6ff', color: e.statut === 'reçu' ? '#16a34a' : '#2563eb' }}>
                                  {e.statut === 'reçu' ? '✓ Reçu' : '🚚 En transit'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, color: 'var(--fs-ink-400)' }}>
                                {e.dateEnvoi ? fmtDate(e.dateEnvoi) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
            );
          })()}

          {/* ════════════════════════════════════════════════════════════════
              ONGLET 5 — ÉTIQUETTES
          ════════════════════════════════════════════════════════════════ */}
          {tab === 'etiquettes' && (
            <div style={{ maxWidth: '100%' }}>
              {/* Barre de contrôles */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {/* Templates */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {ETIQ_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setEtiqTemplate(t.id)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: etiqTemplate === t.id ? 'none' : '1.5px solid var(--fs-line-2)',
                      background: etiqTemplate === t.id ? 'var(--fs-wine-700)' : '#fff',
                      color: etiqTemplate === t.id ? '#fff' : 'var(--fs-ink-500)',
                      fontFamily: 'var(--fs-font-sans)',
                    }}>
                      {t.label} <span style={{ opacity: 0.7, fontSize: 10 }}>{t.size}</span>
                    </button>
                  ))}
                </div>
                {/* Recherche */}
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}>
                    <I d={D.search} size={13}/>
                  </span>
                  <input value={etiqSearch} onChange={e => setEtiqSearch(e.target.value)} placeholder="Rechercher…"
                    style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff', width: '100%', boxSizing: 'border-box' }}/>
                </div>
                {/* Bouton imprimer */}
                {etiqSelected.size > 0 && (
                  <button onClick={handleEtiqPrint} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)', flexShrink: 0,
                  }}>
                    <I d={D.print} size={13}/> Imprimer ({etiqSelected.size})
                  </button>
                )}
              </div>

              {/* Tout sélectionner */}
              {etiqDisplayed.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, padding: '8px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={etiqToggleAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-600)', fontFamily: 'var(--fs-font-sans)' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 3, border: '2px solid var(--fs-wine-700)', background: etiqSelected.size === etiqDisplayed.length ? 'var(--fs-wine-700)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      {etiqSelected.size === etiqDisplayed.length && <I d={D.check} size={10}/>}
                    </div>
                    Tout sélectionner ({etiqDisplayed.length})
                  </button>
                  {etiqSelected.size > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--fs-wine-700)', fontWeight: 600 }}>
                      {etiqSelected.size} étiquette(s) sélectionnée(s)
                    </span>
                  )}
                </div>
              )}

              {/* Grille d'étiquettes */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${etiqTemplate === 'mini' ? 200 : etiqTemplate === 'grande' ? 280 : 240}px, 1fr))`, gap: 14 }}>
                {etiqDisplayed.map(p => (
                  <EtiqLabelCard
                    key={p._id}
                    product={p}
                    template={etiqTemplate}
                    selected={etiqSelected.has(p._id)}
                    onToggle={() => etiqToggle(p._id)}
                  />
                ))}
              </div>

              {etiqDisplayed.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>
                  Aucun produit trouvé
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
