import React, { useState } from 'react';
import { createProduct } from '../api/products';

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
  onCreated: () => void;
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

export default function NouveauProduitModal({ onClose, onCreated }: Props) {
  const [form, setForm]       = useState<FormState>(INITIAL_FORM);
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
    try {
      await createProduct({
        name:           form.name.trim(),
        barcode:        form.barcode.trim() || undefined,
        category:       form.category || undefined,
        unit:           form.unit,
        price:          parseFloat(form.price),
        costPrice:      parseFloat(form.costPrice) || 0,
        stock:          parseInt(form.stock),
        alertThreshold: parseInt(form.alertThreshold) || 5,
      });
      onCreated();
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
            <p style={{ fontWeight: 700, color: '#f5ebd9', fontSize: 15, margin: 0 }}>Nouveau produit</p>
            <p style={{ color: 'rgba(245,235,217,0.6)', fontSize: 12, margin: '2px 0 0' }}>Remplir le formulaire et enregistrer</p>
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
          <FormField label="Code-barres / EAN"   value={form.barcode}  onChange={setField('barcode')}  placeholder="ex: 5900123456789"/>

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
            {loading ? 'Enregistrement…' : 'Enregistrer le produit'}
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
