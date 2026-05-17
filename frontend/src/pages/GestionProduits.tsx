/**
 * Page GestionProduits — gestionnaire de stock
 *
 * Fonctionnalités :
 *  - Liste de tous les produits (lecture)
 *  - Ajout d'un nouveau produit via formulaire simple
 *  - Scan code-barres caméra OU saisie manuelle pour pré-remplir le barcode
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createProduct, getAllProducts, Product, ProductPayload,
} from '../api/products';
import QRScanner from '../components/QRScanner';

// ── Catégories et unités prédéfinies ─────────────────────────────────────────

const CATEGORIES = [
  'Alimentation', 'Boissons', 'Hygiène', 'Ménage',
  'Cosmétique', 'Épicerie', 'Autre',
];

const UNITS = ['pce', 'kg', 'g', 'L', 'cl', 'bouteille', 'boite', 'sachet'];

// ── Formulaire d'ajout ────────────────────────────────────────────────────────

interface FormState {
  barcode:        string;
  name:           string;
  category:       string;
  unit:           string;
  price:          string;
  costPrice:      string;
  stock:          string;
  alertThreshold: string;
  expiryDate:     string;
}

const EMPTY_FORM: FormState = {
  barcode: '', name: '', category: 'Alimentation',
  unit: 'pce', price: '', costPrice: '',
  stock: '0', alertThreshold: '5', expiryDate: '',
};

interface AddModalProps {
  baseCategories: string[];
  onSave:  (payload: ProductPayload) => Promise<void>;
  onClose: () => void;
}

function AddModal({ baseCategories, onSave, onClose }: AddModalProps) {
  const [form,            setForm]            = useState<FormState>(EMPTY_FORM);
  const [showQR,          setShowQR]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [newCatInput,     setNewCatInput]     = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const allCategories = [...baseCategories, ...extraCategories.filter(c => !baseCategories.includes(c))];
  const [markupPct, setMarkupPct] = useState('');

  const applyMarkup = (cost: string, pct: string) => {
    const c = parseFloat(cost);
    const p = parseFloat(pct);
    if (!isNaN(c) && c > 0 && !isNaN(p) && p > 0) {
      setForm(f => ({ ...f, price: String(Math.round(c * (1 + p / 100))) }));
    }
  };

  const confirmNewCat = () => {
    const v = newCatInput.trim();
    if (!v) return;
    if (!allCategories.includes(v)) setExtraCategories(p => [...p, v]);
    set('category', v);
    setNewCatInput('');
  };

  const set = (field: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  // Quand un code-barres est scanné → remplir champ barcode + focus nom
  const handleScan = (code: string) => {
    set('barcode', code);
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Catégorie personnalisée non confirmée → l'utiliser telle quelle
    let finalCategory = form.category;
    if (form.category === '__new__') {
      if (!newCatInput.trim()) { setError('Saisissez et confirmez un nom de catégorie'); return; }
      finalCategory = newCatInput.trim();
      if (!allCategories.includes(finalCategory)) setExtraCategories(p => [...p, finalCategory]);
    }

    const price     = parseFloat(form.price);
    const costPrice = parseFloat(form.costPrice);
    if (isNaN(price) || price < 0)        { setError('Prix de vente invalide');  return; }
    if (isNaN(costPrice) || costPrice < 0) { setError("Prix d'achat invalide");  return; }

    setLoading(true);
    try {
      await onSave({
        name:           form.name.trim(),
        barcode:        form.barcode.trim() || undefined,
        category:       finalCategory,
        unit:           form.unit,
        price,
        costPrice,
        stock:          parseInt(form.stock, 10) || 0,
        alertThreshold: parseInt(form.alertThreshold, 10) || 5,
        expiryDate:     form.expiryDate || null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Scanner caméra (overlay) */}
      {showQR && (
        <QRScanner
          onDetected={code => { setShowQR(false); handleScan(code); }}
          onClose={() => setShowQR(false)}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
          flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md
          max-h-[90vh] overflow-y-auto">

          {/* En-tête */}
          <div className="bg-bordeaux px-6 py-4 sticky top-0 z-10">
            <p className="text-gold font-black text-base tracking-wide">
              Nouveau produit
            </p>
            <p className="text-cream/70 text-xs mt-0.5">
              Remplissez les informations du produit
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

            {/* Code-barres + bouton caméra */}
            <div>
              <label className="label-field">Code-barres</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => set('barcode', e.target.value)}
                  placeholder="Saisir ou scanner…"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  className="px-3 py-2.5 rounded-xl border-2 border-bordeaux/25
                    text-bordeaux hover:bg-bordeaux hover:text-cream
                    hover:border-bordeaux transition-colors text-lg"
                  title="Scanner avec la caméra"
                >
                  📷
                </button>
              </div>
            </div>

            {/* Nom */}
            <div>
              <label className="label-field">Nom du produit *</label>
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v) set('name', v.charAt(0).toUpperCase() + v.slice(1).toLowerCase());
                }}
                required
                placeholder="ex: Huile diamaor 1l"
                className="input-field w-full"
              />
            </div>

            {/* Catégorie + Unité */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Catégorie</label>
                <select
                  value={allCategories.includes(form.category) ? form.category : '__new__'}
                  onChange={e => {
                    set('category', e.target.value);
                    if (e.target.value !== '__new__') setNewCatInput('');
                  }}
                  className="input-field w-full"
                >
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">＋ Nouvelle…</option>
                </select>
                {form.category === '__new__' && (
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={e => setNewCatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmNewCat(); } }}
                      placeholder="Nom de la catégorie…"
                      autoFocus
                      className="input-field flex-1 text-xs py-1.5"
                    />
                    <button
                      type="button"
                      onClick={confirmNewCat}
                      disabled={!newCatInput.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-bordeaux text-cream text-xs font-bold disabled:opacity-40 shrink-0"
                    >
                      OK
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="label-field">Unité</label>
                <select
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  className="input-field w-full"
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Prix achat + marge → prix vente */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Prix achat (FCFA)</label>
                <input
                  type="number" min={0} value={form.costPrice}
                  onChange={e => { set('costPrice', e.target.value); applyMarkup(e.target.value, markupPct); }}
                  placeholder="0" className="input-field w-full"
                />
              </div>
              <div>
                <label className="label-field">Marge (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={500} step={1}
                    value={markupPct}
                    onChange={e => { setMarkupPct(e.target.value); applyMarkup(form.costPrice, e.target.value); }}
                    placeholder="0" className="input-field w-full"
                  />
                  <span className="text-gray-400 font-bold text-sm">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="label-field">Prix vente (FCFA) *</label>
              <input
                type="number" min={0} value={form.price}
                onChange={e => { set('price', e.target.value); setMarkupPct(''); }}
                required placeholder="0"
                className="input-field w-full"
                style={{ background: markupPct ? '#f0fdf4' : undefined }}
              />
              {markupPct && form.costPrice && form.price && (
                <p className="text-green-700 text-xs mt-1 font-semibold">
                  {form.costPrice} × {markupPct}% → {form.price} XAF
                </p>
              )}
            </div>

            {/* Stock initial + Seuil alerte */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Stock initial</label>
                <input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={e => set('stock', e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="label-field">Seuil alerte</label>
                <input
                  type="number"
                  min={0}
                  value={form.alertThreshold}
                  onChange={e => set('alertThreshold', e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>

            {/* Date de péremption */}
            <div>
              <label className="label-field">📅 Date de péremption <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optionnel)</span></label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => set('expiryDate', e.target.value)}
                className="input-field w-full"
              />
              {form.expiryDate && new Date(form.expiryDate) < new Date() && (
                <p className="text-red-600 text-xs mt-1 font-semibold">⚠ Date déjà expirée</p>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700
                rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                <span>✕</span>{error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-bordeaux hover:bg-bordeaux-dark
                  disabled:opacity-50 text-cream font-bold text-sm rounded-xl
                  border-2 border-gold transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-cream/30 border-t-cream
                      rounded-full animate-spin" />
                    Enregistrement…
                  </span>
                ) : 'Ajouter le produit'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm
                  font-bold text-gray-600 hover:bg-cream transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function GestionProduits() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search,    setSearch]    = useState('');
  const [success,   setSuccess]   = useState<string | null>(null);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setProducts(await getAllProducts()); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Catégories dérivées des produits réels + liste de base (ordre alphabétique)
  const derivedCategories = useMemo(() => {
    const set = new Set(CATEGORIES);
    products.forEach(p => { if (p.category?.trim()) set.add(p.category.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [products]);

  // Filtre recherche
  const displayed = products.filter(p => {
    const q = search.toLowerCase();
    return !q ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q);
  });

  const handleSave = async (payload: ProductPayload) => {
    const created = await createProduct(payload);
    setProducts(prev => [...prev, created].sort((a, b) =>
      a.name.localeCompare(b.name)));
    setShowModal(false);
    flash(`Produit "${created.name}" ajouté`);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Modal ajout */}
      {showModal && (
        <AddModal baseCategories={derivedCategories} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center
        justify-between px-6 py-3 shrink-0 shadow-sm">
        <h2 className="font-bold text-bordeaux text-lg">Produits</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-bordeaux hover:bg-bordeaux-dark
            text-cream text-sm font-bold px-4 py-2 rounded-xl
            border-2 border-gold transition-colors"
        >
          <span>+</span> Ajouter un produit
        </button>
      </header>

      <main className="flex-1 px-6 py-4 flex flex-col gap-4">

        {/* Feedback */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl
            px-4 py-3 text-sm flex items-center gap-2">
            <span>✕</span>{error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl
            px-4 py-3 text-sm flex items-center gap-2">
            <span>✓</span>{success}
          </div>
        )}

        {/* Barre de recherche */}
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, code-barres, catégorie…"
          className="w-full max-w-sm px-4 py-2 rounded-xl border border-gray-200
            bg-white text-sm outline-none focus:border-bordeaux transition-colors"
        />

        {/* Chargement */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-bordeaux/20 border-t-bordeaux
              rounded-full animate-spin" />
          </div>
        )}

        {/* Liste */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow border border-cream-dark
            overflow-hidden">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12
                text-gray-300 gap-2">
                <span className="text-4xl">📦</span>
                <p className="text-sm">
                  {search ? 'Aucun produit trouvé' : 'Aucun produit — ajoutez-en un !'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-cream/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      Produit
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Code-barres
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Catégorie
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      Prix
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayed.map(p => {
                    const low = p.stock <= p.alertThreshold;
                    return (
                      <tr key={p._id}
                        className={`hover:bg-cream/30 transition-colors
                          ${low ? 'bg-red-50/30' : ''}`}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.unit}</p>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <span className="font-mono text-xs text-gray-500
                            bg-gray-100 px-2 py-0.5 rounded">
                            {p.barcode ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500
                          hidden lg:table-cell">
                          {p.category ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 font-medium">
                          {p.price.toLocaleString('fr-FR')} F
                        </td>
                        <td className={`px-5 py-3 text-right font-bold
                          ${low ? 'text-red-600' : 'text-green-700'}`}>
                          {p.stock}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-4">
          {products.length} produit{products.length > 1 ? 's' : ''} au total
        </p>
      </main>
    </div>
  );
}
