import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createProduct, updateProduct, getProductByBarcode, Product } from '../api/products';
import { getFournisseurs } from '../api/fournisseurs';
import AutocompleteInput from './AutocompleteInput';
import QRScanner from './QRScanner';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['Beauté', 'Hygiène', 'Parfumerie', 'Épicerie', 'Boissons', 'Alimentation', 'Bien-être', 'Maison'];
const UNITS = ['unité', 'kg', 'g', 'L', 'mL', 'pièce', 'boîte', 'sachet', 'bouteille'];

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--fs-ink-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  display: 'block',
  marginBottom: 4,
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

// ── BarcodeField ──────────────────────────────────────────────────────────────

const ICON_BTN: React.CSSProperties = {
  padding: '0 10px', height: 36, border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12,
  flexShrink: 0, color: 'var(--fs-ink-600)', fontFamily: 'var(--fs-font-sans)',
  display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
};

function BarcodeField({ value, onChange, onCameraScan }: { value: string; onChange: (v: string) => void; onCameraScan?: () => void }) {
  const [scanMode, setScanMode] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (value && canvasRef.current) drawCode39(canvasRef.current, value);
  }, [value]);

  const activateScan = () => {
    setScanMode(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (v) setScanMode(false);
  };

  const generate = () => {
    onChange('FS' + String(Date.now() % 10000000000).padStart(10, '0'));
    setScanMode(false);
  };

  return (
    <div>
      <label style={LABEL_STYLE}>Code-barres / EAN</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => { if (!value) setScanMode(false); }}
          placeholder={scanMode ? 'Pointez le scanner sur le produit...' : 'Scanner ou taper le code'}
          style={{
            ...INPUT_STYLE,
            border: scanMode ? '1.5px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)',
            boxShadow: scanMode ? '0 0 0 3px rgba(122,29,46,0.10)' : 'none',
            animation: scanMode ? 'scanPulse 1.2s ease-in-out infinite' : 'none',
          }}
        />
        <button type="button" onClick={activateScan} style={ICON_BTN} title="Mode scan USB">
          📷 Scanner
        </button>
        <button type="button" onClick={generate} style={ICON_BTN} title="Générer un code interne">
          🎲 Générer
        </button>
        {onCameraScan && (
          <button type="button" onClick={onCameraScan} style={ICON_BTN} title="Scanner avec caméra">
            📱 Caméra
          </button>
        )}
      </div>

      {value && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--fs-ivory)', borderRadius: 8, border: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
          <canvas ref={canvasRef} style={{ height: 44, imageRendering: 'pixelated' }}/>
          <span style={{ fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)', fontWeight: 600 }}>{value}</span>
        </div>
      )}
      <style>{`@keyframes scanPulse{0%,100%{box-shadow:0 0 0 3px rgba(122,29,46,0.10)}50%{box-shadow:0 0 0 5px rgba(122,29,46,0.22)}}`}</style>
    </div>
  );
}

// ── FormField — défini au niveau du module, jamais recréé ─────────────────────
//
// IMPORTANT : ce composant doit rester ici, à la racine du fichier, et non à
// l'intérieur d'un autre composant. S'il était déclaré dans NouveauProduitModal,
// React l'identifierait comme un nouveau type à chaque render et détruirait/
// recréérait le <input>, causant la perte du focus à chaque frappe.

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

function FormField({ label, value, onChange, type = 'text', placeholder = '' }: FormFieldProps) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={INPUT_STYLE}
      />
    </div>
  );
}

// ── Icon helper — aussi au niveau du module ───────────────────────────────────

function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose:          () => void;
  onCreated?:       () => void;
  onUpdated?:       () => void;
  product?:         Product;
  knownCategories?: string[];
  existingProducts?: Product[];
  /** Pré-remplissage en mode création (ex: régularisation d'un article divers) */
  prefill?:         { name?: string; price?: string };
}

function defaultExpiryDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type FormState = {
  name: string; localName: string; barcode: string; category: string; subCategory: string;
  fournisseur: string; unit: string; valeur: string; price: string; costPrice: string; stock: string;
  discount: string; expiryDate: string;
};

const INITIAL_FORM: FormState = {
  name: '', localName: '', barcode: '', category: '', subCategory: '', fournisseur: '', unit: 'unité',
  valeur: '', price: '', costPrice: '', stock: '', discount: '0', expiryDate: defaultExpiryDate(),
};

// ── Modal component ───────────────────────────────────────────────────────────

export default function NouveauProduitModal({ onClose, onCreated, onUpdated, product, knownCategories, existingProducts = [], prefill }: Props) {
  const [form, setForm] = useState<FormState>(() => product ? {
    name:        product.name,
    localName:   product.localName ?? '',
    barcode:     product.barcode ?? '',
    category:    product.category ?? '',
    unit:        product.unit,
    valeur:      product.valeur ?? '',
    price:       String(product.price),
    costPrice:   String(product.costPrice),
    stock:       String(product.stock),
    discount:    String(product.discount ?? 0),
    expiryDate:  product.expiryDate ? product.expiryDate.slice(0, 10) : defaultExpiryDate(),
    subCategory: product.subCategory ?? '',
    fournisseur: product.fournisseur ?? '',
  } : { ...INITIAL_FORM, name: prefill?.name ?? '', price: prefill?.price ?? '' });
  const [fournisseurs, setFournisseurs] = useState<string[]>([]);

  useEffect(() => {
    getFournisseurs()
      .then(list => setFournisseurs(list.map(f => f.name)))
      .catch(() => {});
  }, []);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [newCatInput,     setNewCatInput]     = useState('');
  const [markupPct,       setMarkupPct]       = useState('');
  const [foundProduct,    setFoundProduct]    = useState<Product | null>(null);
  const [showScanner,     setShowScanner]     = useState(false);

  // Fallback API si non trouvé localement (gère les listes périmées)
  useEffect(() => {
    if (!form.barcode.trim() || product || foundProduct) return;
    const localFound = existingProducts.find(p =>
      p.barcode && p.barcode.toLowerCase() === form.barcode.trim().toLowerCase()
    );
    if (localFound) return;
    const timer = setTimeout(async () => {
      try {
        const apiFound = await getProductByBarcode(form.barcode.trim());
        setFoundProduct(apiFound);
        setForm({
          name:        apiFound.name,
          localName:   apiFound.localName ?? '',
          barcode:     apiFound.barcode ?? form.barcode,
          category:    apiFound.category ?? '',
          subCategory: apiFound.subCategory ?? '',
          fournisseur: apiFound.fournisseur ?? '',
          unit:        apiFound.unit,
          valeur:      apiFound.valeur ?? '',
          price:       String(apiFound.price),
          costPrice:   String(apiFound.costPrice),
          stock:       String(apiFound.stock),
          discount:    String(apiFound.discount ?? 0),
          expiryDate:  apiFound.expiryDate ? apiFound.expiryDate.slice(0, 10) : defaultExpiryDate(),
        });
        setMarkupPct('');
      } catch { /* nouveau produit */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.barcode, product, foundProduct, existingProducts]);

  // Recherche produit existant par code-barres
  const lookupBarcode = (code: string) => {
    if (!code.trim() || product) { setFoundProduct(null); return; }
    const found = existingProducts.find(p =>
      p.barcode && p.barcode.toLowerCase() === code.trim().toLowerCase()
    );
    if (found) {
      setFoundProduct(found);
      setForm({
        name:        found.name,
        localName:   found.localName ?? '',
        barcode:     found.barcode ?? code,
        category:    found.category ?? '',
        subCategory: found.subCategory ?? '',
        fournisseur: found.fournisseur ?? '',
        unit:        found.unit,
        valeur:      found.valeur ?? '',
        price:       String(found.price),
        costPrice:   String(found.costPrice),
        stock:       String(found.stock),
        discount:    String(found.discount ?? 0),
        expiryDate:  found.expiryDate ? found.expiryDate.slice(0, 10) : defaultExpiryDate(),
      });
      setMarkupPct('');
    } else {
      setFoundProduct(null);
    }
  };

  const applyMarkup = (cost: string, pct: string) => {
    const c = parseFloat(cost);
    const p = parseFloat(pct);
    if (!isNaN(c) && c > 0 && !isNaN(p) && p > 0) {
      setForm(f => ({ ...f, price: String(Math.round(c * (1 + p / 100))) }));
    }
  };

  const allCategories = useMemo(() => {
    const base = new Set([...CATEGORIES, ...(knownCategories ?? [])]);
    extraCategories.forEach(c => base.add(c));
    if (product?.category) base.add(product.category);
    return Array.from(base).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [knownCategories, extraCategories, product]);

  const allSubCategories = useMemo(() => {
    const base = new Set<string>();
    (existingProducts ?? []).forEach(p => { if (p.subCategory) base.add(p.subCategory); });
    if (product?.subCategory) base.add(product.subCategory);
    return Array.from(base).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [existingProducts, product]);

  const confirmNewCat = () => {
    const v = newCatInput.trim();
    if (!v) return;
    if (!allCategories.includes(v)) setExtraCategories(p => [...p, v]);
    setForm(f => ({ ...f, category: v }));
    setNewCatInput('');
  };

  const setField = (k: keyof FormState) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const computedThreshold = Math.max(1, Math.ceil((parseInt(form.stock) || 0) * 0.10));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price || !form.stock) {
      setError('Nom, prix et stock initial sont requis.');
      return;
    }
    let finalCategory = form.category;
    if (form.category === '__new__') {
      if (!newCatInput.trim()) { setError('Saisissez et confirmez un nom de catégorie'); return; }
      finalCategory = newCatInput.trim();
    }
    setLoading(true);
    setError('');
    const rawName = form.name.trim();
    const payload = {
      name:        rawName.charAt(0).toUpperCase() + rawName.slice(1),
      localName:   form.localName.trim() || undefined,
      barcode:     form.barcode.trim() || undefined,
      category:    finalCategory || undefined,
      unit:        form.unit,
      valeur:      form.valeur.trim() || undefined,
      price:       parseFloat(form.price),
      costPrice:   parseFloat(form.costPrice) || 0,
      stock:       parseInt(form.stock),
      discount:    Math.min(100, Math.max(0, parseFloat(form.discount) || 0)),
      expiryDate:  form.expiryDate || null,
      subCategory: form.subCategory.trim() || undefined,
      fournisseur: form.fournisseur.trim() || undefined,
    };
    try {
      if (product || foundProduct) {
        await updateProduct((product ?? foundProduct)!._id, payload);
        onUpdated?.();
      } else {
        await createProduct(payload);
        onCreated?.();
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {showScanner && (
      <QRScanner
        onDetected={code => { setShowScanner(false); setField('barcode')(code); lookupBarcode(code); }}
        onClose={() => setShowScanner(false)}
      />
    )}
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--fs-shadow-lg)' }}>

        {/* Header */}
        <div style={{ background: 'var(--fs-wine-700)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>{product ? 'Modifier le produit' : 'Nouveau produit'}</p>
            <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 12, margin: '2px 0 0' }}>{product ? (product.localName ? `${product.name} · ${product.localName}` : product.name) : 'Remplir le formulaire et enregistrer'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,235,217,0.7)', cursor: 'pointer', display: 'flex' }}>
            <CloseIcon/>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div style={{ background: 'var(--fs-danger-100)', color: 'var(--fs-danger-700)', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Nom d'origine + nom local (hamburger) */}
          <div>
            <label style={LABEL_STYLE}>Nom d'origine *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setField('name')(e.target.value)}
              onBlur={e => { const v = e.target.value.trim(); if (v) setField('name')(v.charAt(0).toUpperCase() + v.slice(1)); }}
              placeholder="ex: Nivea Shampoing 400ml"
              style={INPUT_STYLE}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Nom local <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel)</span></label>
            <input
              type="text"
              value={form.localName}
              onChange={e => setField('localName')(e.target.value)}
              placeholder="ex: Shampoua ya asali"
              style={INPUT_STYLE}
            />
            {form.name && form.localName && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: 'var(--fs-ivory)', borderRadius: 8, border: '1px solid var(--fs-line)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{form.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{form.localName}</div>
              </div>
            )}
          </div>
          <BarcodeField value={form.barcode} onChange={v => { setField('barcode')(v); lookupBarcode(v); }} onCameraScan={() => setShowScanner(true)}/>
          {foundProduct && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>Produit déjà enregistré — informations chargées</div>
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>Modifiez les champs si nécessaire puis cliquez <strong>Mettre à jour</strong>.</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Catégorie</label>
              <AutocompleteInput
                value={form.category}
                onChange={v => setField('category')(v)}
                suggestions={allCategories}
                placeholder="Saisir ou choisir une catégorie…"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Sous-catégorie <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel)</span></label>
              <AutocompleteInput
                value={form.subCategory}
                onChange={v => setField('subCategory')(v)}
                suggestions={allSubCategories}
                placeholder="ex: Parfum, Shampoing…"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Unité</label>
              <select
                value={form.unit}
                onChange={e => setField('unit')(e.target.value)}
                style={{ ...INPUT_STYLE, background: '#fff' }}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Valeur <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel)</span></label>
              <input
                type="text"
                value={form.valeur}
                onChange={e => setField('valeur')(e.target.value)}
                placeholder="ex: 50mL, 250g, 1L…"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL_STYLE}>Fournisseur <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel)</span></label>
              <AutocompleteInput
                value={form.fournisseur}
                onChange={v => setField('fournisseur')(v)}
                suggestions={fournisseurs}
                placeholder="Choisir un fournisseur…"
              />
            </div>
          </div>

          {/* Prix achat + marge → prix vente */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end' }}>
            <div>
              <label style={LABEL_STYLE}>Prix d'achat (XAF)</label>
              <input
                type="number" min={0} value={form.costPrice}
                onChange={e => { setField('costPrice')(e.target.value); applyMarkup(e.target.value, markupPct); }}
                placeholder="ex: 300"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ textAlign: 'center' }}>
              <label style={{ ...LABEL_STYLE, textAlign: 'center' }}>Marge %</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number" min={0} max={500} step={1}
                  value={markupPct}
                  onChange={e => { setMarkupPct(e.target.value); applyMarkup(form.costPrice, e.target.value); }}
                  placeholder="0"
                  style={{ ...INPUT_STYLE, width: 60, textAlign: 'center' }}
                />
                <span style={{ fontSize: 13, color: 'var(--fs-ink-400)', flexShrink: 0 }}>%</span>
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Prix de vente * (XAF)</label>
              <input
                type="number" min={0} value={form.price}
                onChange={e => { setField('price')(e.target.value); setMarkupPct(''); }}
                placeholder="ex: 500"
                style={{ ...INPUT_STYLE, background: markupPct ? '#f0fdf4' : '#fff', borderColor: markupPct ? '#86efac' : undefined }}
              />
            </div>
          </div>
          {markupPct && form.costPrice && form.price && (
            <div style={{ fontSize: 11, color: 'var(--fs-success-700)', fontWeight: 600, marginTop: -4 }}>
              {form.costPrice} XAF × {markupPct}% de marge → {form.price} XAF
            </div>
          )}

          <div>
            <label style={LABEL_STYLE}>🏷️ Réduction (%)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" min={0} max={100} step={1}
                value={form.discount}
                onChange={e => setField('discount')(String(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))))}
                placeholder="0"
                style={{ ...INPUT_STYLE, width: 100 }}
              />
              <span style={{ fontSize: 13, color: 'var(--fs-ink-500)' }}>%</span>
              {parseFloat(form.discount) > 0 && form.price && (
                <span style={{ fontSize: 12, color: '#c0392b', fontWeight: 700 }}>
                  Prix client : {Math.round(parseFloat(form.price) * (1 - parseFloat(form.discount) / 100)).toLocaleString('fr-FR')} XAF
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Stock initial *" value={form.stock} onChange={setField('stock')} type="number" placeholder="ex: 50"/>
            <div>
              <label style={LABEL_STYLE}>Seuil d'alerte <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(auto 10%)</span></label>
              <div style={{ ...INPUT_STYLE, background: 'var(--fs-ivory)', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--fs-font-mono)' }}>{computedThreshold}</span>
                <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>= 10% de {form.stock || '0'}</span>
              </div>
            </div>
          </div>

          <div>
            <label style={LABEL_STYLE}>📅 Date de péremption <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(défaut : +1 an)</span></label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={e => setField('expiryDate')(e.target.value)}
              style={{ ...INPUT_STYLE }}
            />
            {form.expiryDate && new Date(form.expiryDate) < new Date() && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#c0392b', fontWeight: 600 }}>⚠ Date déjà expirée</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 1, padding: '11px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? ((product || foundProduct) ? 'Mise à jour…' : 'Enregistrement…')
              : ((product || foundProduct) ? 'Mettre à jour' : 'Enregistrer le produit')}
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px', background: 'none', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}
          >
            Annuler
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
