import React, { useEffect, useRef, useState } from 'react';
import { createProduct, updateProduct, Product } from '../api/products';

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

function BarcodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
  onClose: () => void;
  onCreated?: () => void;
  onUpdated?: () => void;
  product?: Product;
}

type FormState = {
  name: string;
  barcode: string;
  category: string;
  unit: string;
  price: string;
  costPrice: string;
  stock: string;
  alertThreshold: string;
};

const INITIAL_FORM: FormState = {
  name: '', barcode: '', category: '', unit: 'unité',
  price: '', costPrice: '', stock: '', alertThreshold: '',
};

// ── Modal component ───────────────────────────────────────────────────────────

export default function NouveauProduitModal({ onClose, onCreated, onUpdated, product }: Props) {
  const [form, setForm] = useState<FormState>(() => product ? {
    name:           product.name,
    barcode:        product.barcode ?? '',
    category:       product.category ?? '',
    unit:           product.unit,
    price:          String(product.price),
    costPrice:      String(product.costPrice),
    stock:          String(product.stock),
    alertThreshold: String(product.alertThreshold),
  } : INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Utilise la forme fonctionnelle pour éviter les closures périmées
  const setField = (k: keyof FormState) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.price || !form.stock) {
      setError('Nom, prix et stock initial sont requis.');
      return;
    }
    setLoading(true);
    setError('');
    const payload = {
      name:           form.name.trim(),
      barcode:        form.barcode.trim() || undefined,
      category:       form.category || undefined,
      unit:           form.unit,
      price:          parseFloat(form.price),
      costPrice:      parseFloat(form.costPrice) || 0,
      stock:          parseInt(form.stock),
      alertThreshold: parseInt(form.alertThreshold) || 5,
    };
    try {
      if (product) {
        await updateProduct(product._id, payload);
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
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: 560, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--fs-shadow-lg)' }}>

        {/* Header */}
        <div style={{ background: 'var(--fs-wine-700)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>{product ? 'Modifier le produit' : 'Nouveau produit'}</p>
            <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 12, margin: '2px 0 0' }}>{product ? product.name : 'Remplir le formulaire et enregistrer'}</p>
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

          {/* FormField reçoit value + onChange — pas de fermeture sur form */}
          <FormField label="Nom du produit *"    value={form.name}     onChange={setField('name')}     placeholder="ex: Savon Lux Rose 90g"/>
          <BarcodeField value={form.barcode} onChange={setField('barcode')}/>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL_STYLE}>Catégorie</label>
              <select
                value={form.category}
                onChange={e => setField('category')(e.target.value)}
                style={{ ...INPUT_STYLE, background: '#fff' }}
              >
                <option value="">— Sélectionner —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Prix de vente * (XAF)" value={form.price}     onChange={setField('price')}     type="number" placeholder="ex: 500"/>
            <FormField label="Prix d'achat (XAF)"    value={form.costPrice} onChange={setField('costPrice')} type="number" placeholder="ex: 300"/>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Stock initial *" value={form.stock}          onChange={setField('stock')}          type="number" placeholder="ex: 50"/>
            <FormField label="Seuil d'alerte"  value={form.alertThreshold} onChange={setField('alertThreshold')} type="number" placeholder="ex: 10"/>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--fs-line)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ flex: 1, padding: '11px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (product ? 'Mise à jour…' : 'Enregistrement…') : (product ? 'Mettre à jour' : 'Enregistrer le produit')}
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
  );
}
