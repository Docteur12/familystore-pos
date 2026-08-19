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
  createProduct, updateProduct, getAllProducts, getProductByBarcode, Product, ProductPayload,
} from '../api/products';
import QRScanner          from '../components/QRScanner';
import AutocompleteInput  from '../components/AutocompleteInput';
import { contientTexte } from '../utils/text';
import { matchesStockStatus } from '../utils/stock';
import { t, dateLocale } from '../i18n';

// ── Catégories et unités prédéfinies ─────────────────────────────────────────

const CATEGORIES = [
  'Alimentation', 'Boissons', 'Hygiène', 'Ménage',
  'Cosmétique', 'Épicerie', 'Autre',
];

const UNITS = ['pce', 'kg', 'g', 'L', 'cl', 'bouteille', 'boite', 'sachet'];
// Libellés affichés des unités — les VALEURS envoyées au backend restent en français.
const UNIT_LABELS: Record<string, string> = {
  pce: t('pce', 'pc'), bouteille: t('bouteille', 'bottle'), boite: t('boite', 'box'),
};

// ── Formulaire d'ajout ────────────────────────────────────────────────────────

function defaultExpiryDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

interface FormState {
  barcode:     string;
  name:        string;
  localName:   string;
  category:    string;
  unit:        string;
  valeur:      string;
  subCategory: string;
  price:       string;
  costPrice:   string;
  stock:       string;
  expiryDate:  string;
}

const EMPTY_FORM: FormState = {
  barcode: '', name: '', localName: '', category: 'Alimentation', subCategory: '',
  unit: 'pce', valeur: '', price: '', costPrice: '',
  stock: '0', expiryDate: defaultExpiryDate(),
};

interface AddModalProps {
  baseCategories:   string[];
  existingProducts: Product[];
  onSave:           (payload: ProductPayload) => Promise<void>;
  onSaveExisting?:  (id: string, payload: Partial<ProductPayload>) => Promise<void>;
  onClose:          () => void;
}

function AddModal({ baseCategories, existingProducts, onSave, onSaveExisting, onClose }: AddModalProps) {
  const [form,            setForm]            = useState<FormState>(EMPTY_FORM);
  const [showQR,          setShowQR]          = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [newCatInput,     setNewCatInput]     = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const allCategories    = [...baseCategories, ...extraCategories.filter(c => !baseCategories.includes(c))];
  const allSubCategories = [...new Set(existingProducts.map(p => p.subCategory).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, dateLocale()));
  const [markupPct,    setMarkupPct]    = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);

  // Fallback API si non trouvé localement (gère les listes périmées)
  useEffect(() => {
    if (!form.barcode.trim() || foundProduct) return;
    const localFound = existingProducts.find(p =>
      p.barcode && p.barcode.toLowerCase() === form.barcode.trim().toLowerCase()
    );
    if (localFound) return;
    const timer = setTimeout(async () => {
      try {
        const apiFound = await getProductByBarcode(form.barcode.trim());
        setFoundProduct(apiFound);
        setForm({
          barcode:     apiFound.barcode ?? form.barcode,
          name:        apiFound.name,
          localName:   apiFound.localName ?? '',
          category:    apiFound.category ?? 'Alimentation',
          subCategory: apiFound.subCategory ?? '',
          unit:        apiFound.unit,
          valeur:      apiFound.valeur ?? '',
          price:       String(apiFound.price),
          costPrice:   String(apiFound.costPrice),
          stock:       String(apiFound.stock),
          expiryDate:  apiFound.expiryDate ? apiFound.expiryDate.slice(0, 10) : defaultExpiryDate(),
        });
        setMarkupPct('');
      } catch { /* nouveau produit */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.barcode, foundProduct, existingProducts]);

  const lookupBarcode = (code: string) => {
    if (!code.trim()) { setFoundProduct(null); return; }
    const found = existingProducts.find(p =>
      p.barcode && p.barcode.toLowerCase() === code.trim().toLowerCase()
    );
    if (found) {
      setFoundProduct(found);
      setForm({
        barcode:     found.barcode ?? code,
        name:        found.name,
        localName:   found.localName ?? '',
        category:    found.category ?? 'Alimentation',
        subCategory: found.subCategory ?? '',
        unit:        found.unit,
        valeur:      found.valeur ?? '',
        price:       String(found.price),
        costPrice:   String(found.costPrice),
        stock:       String(found.stock),
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
    lookupBarcode(code);
    setTimeout(() => nameRef.current?.focus(), 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Catégorie personnalisée non confirmée → l'utiliser telle quelle
    let finalCategory = form.category;
    if (form.category === '__new__') {
      if (!newCatInput.trim()) { setError(t('Saisissez et confirmez un nom de catégorie', 'Enter and confirm a category name')); return; }
      finalCategory = newCatInput.trim();
      if (!allCategories.includes(finalCategory)) setExtraCategories(p => [...p, finalCategory]);
    }

    const price     = parseFloat(form.price);
    const costPrice = parseFloat(form.costPrice);
    if (isNaN(price) || price < 0)        { setError(t('Prix de vente invalide', 'Invalid selling price'));  return; }
    if (isNaN(costPrice) || costPrice < 0) { setError(t("Prix d'achat invalide", 'Invalid purchase price'));  return; }

    const payload: ProductPayload = {
      name:        form.name.trim(),
      localName:   form.localName.trim() || undefined,
      barcode:     form.barcode.trim() || undefined,
      category:    finalCategory,
      subCategory: form.subCategory.trim() || undefined,
      unit:        form.unit,
      valeur:      form.valeur.trim() || undefined,
      price,
      costPrice,
      stock:       parseInt(form.stock, 10) || 0,
      expiryDate:  form.expiryDate || null,
    };

    setLoading(true);
    try {
      if (foundProduct && onSaveExisting) {
        await onSaveExisting(foundProduct._id, payload);
      } else {
        await onSave(payload);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Erreur', 'Error'));
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
              {t('Nouveau produit', 'New product')}
            </p>
            <p className="text-cream/70 text-xs mt-0.5">
              {t('Remplissez les informations du produit', 'Fill in the product details')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">

            {/* Produit existant trouvé */}
            {foundProduct && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 items-start">
                <span className="text-xl">🔍</span>
                <div>
                  <p className="text-blue-800 font-bold text-sm">{t('Produit déjà enregistré — informations chargées', 'Product already registered — details loaded')}</p>
                  <p className="text-blue-600 text-xs mt-0.5">{t('Modifiez si nécessaire puis cliquez', 'Edit if needed, then click')} <strong>{t('Mettre à jour', 'Update')}</strong>.</p>
                </div>
              </div>
            )}

            {/* Code-barres + bouton caméra */}
            <div>
              <label className="label-field">{t('Code-barres', 'Barcode')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.barcode}
                  onChange={e => { set('barcode', e.target.value); lookupBarcode(e.target.value); }}
                  placeholder={t('Saisir ou scanner…', 'Type or scan…')}
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  className="px-3 py-2.5 rounded-xl border-2 border-bordeaux/25
                    text-bordeaux hover:bg-bordeaux hover:text-cream
                    hover:border-bordeaux transition-colors text-lg"
                  title={t('Scanner avec la caméra', 'Scan with the camera')}
                >
                  📷
                </button>
              </div>
            </div>

            {/* Nom d'origine + nom local */}
            <div>
              <label className="label-field">{t("Nom d'origine *", 'Original name *')}</label>
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onBlur={e => {
                  const v = e.target.value.trim();
                  if (v) set('name', v.charAt(0).toUpperCase() + v.slice(1));
                }}
                required
                placeholder={t('ex: Huile diamaor 1L', 'e.g. Diamaor oil 1L')}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="label-field">{t('Nom local', 'Local name')} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{t('(optionnel)', '(optional)')}</span></label>
              <input
                type="text"
                value={form.localName}
                onChange={e => set('localName', e.target.value)}
                placeholder={t('ex: Mafuta ya asali', 'e.g. Mafuta ya asali')}
                className="input-field w-full"
              />
              {form.name && form.localName && (
                <div className="mt-1.5 px-3 py-2 bg-cream rounded-lg border border-gray-100 text-xs">
                  <span className="font-bold text-gray-800">{form.name}</span>
                  <br/>
                  <span className="text-gray-400">{form.localName}</span>
                </div>
              )}
            </div>

            {/* Catégorie + Unité + Valeur */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">{t('Catégorie', 'Category')}</label>
                <AutocompleteInput
                  value={form.category}
                  onChange={v => set('category', v)}
                  suggestions={allCategories}
                  placeholder={t('Saisir ou choisir…', 'Type or choose…')}
                />
              </div>
              <div>
                <label className="label-field">{t('Unité', 'Unit')}</label>
                <select
                  value={form.unit}
                  onChange={e => set('unit', e.target.value)}
                  className="input-field w-full"
                >
                  {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u] ?? u}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label-field">{t('Valeur', 'Value')} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{t('(optionnel — ex: 50mL, 250g)', '(optional — e.g. 50mL, 250g)')}</span></label>
                <input
                  type="text"
                  value={form.valeur}
                  onChange={e => set('valeur', e.target.value)}
                  placeholder={t('ex: 50mL, 1L, 250g…', 'e.g. 50mL, 1L, 250g…')}
                  className="input-field w-full"
                />
              </div>
            </div>

            {/* Sous-catégorie */}
            <div>
              <label className="label-field">{t('Sous-catégorie', 'Subcategory')} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{t('(optionnel)', '(optional)')}</span></label>
              <AutocompleteInput
                value={form.subCategory}
                onChange={v => set('subCategory', v)}
                suggestions={allSubCategories}
                placeholder={t('ex: Parfum, Shampoing, Lait...', 'e.g. Perfume, Shampoo, Milk...')}
              />
            </div>

            {/* Prix achat + marge → prix vente */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">{t('Prix achat (FCFA)', 'Purchase price (FCFA)')}</label>
                <input
                  type="number" min={0} value={form.costPrice}
                  onChange={e => { set('costPrice', e.target.value); applyMarkup(e.target.value, markupPct); }}
                  placeholder="0" className="input-field w-full"
                />
              </div>
              <div>
                <label className="label-field">{t('Marge (%)', 'Markup (%)')}</label>
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
              <label className="label-field">{t('Prix vente (FCFA) *', 'Selling price (FCFA) *')}</label>
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

            {/* Stock initial + Seuil alerte auto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">{t('Stock initial', 'Initial stock')}</label>
                <input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={e => set('stock', e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="label-field">{t('Seuil alerte', 'Alert threshold')} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{t('(auto 10%)', '(auto 10%)')}</span></label>
                <div className="input-field w-full bg-gray-50 text-gray-500 flex items-center justify-between cursor-not-allowed select-none">
                  <span className="font-bold font-mono">
                    {Math.max(1, Math.ceil((parseInt(form.stock, 10) || 0) * 0.10))}
                  </span>
                  <span className="text-xs text-gray-400">{t('= 10% de', '= 10% of')} {form.stock || '0'}</span>
                </div>
              </div>
            </div>

            {/* Date de péremption */}
            <div>
              <label className="label-field">📅 {t('Date de péremption', 'Expiry date')} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>{t('(défaut : +1 an)', '(default: +1 year)')}</span></label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => set('expiryDate', e.target.value)}
                className="input-field w-full"
              />
              {form.expiryDate && new Date(form.expiryDate) < new Date() && (
                <p className="text-red-600 text-xs mt-1 font-semibold">{t('⚠ Date déjà expirée', '⚠ Date already expired')}</p>
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
                    {t('Enregistrement…', 'Saving…')}
                  </span>
                ) : (foundProduct ? t('Mettre à jour', 'Update') : t('Ajouter le produit', 'Add product'))}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm
                  font-bold text-gray-600 hover:bg-cream transition-colors"
              >
                {t('Annuler', 'Cancel')}
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
    catch (err: unknown) { setError(err instanceof Error ? err.message : t('Erreur', 'Error')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Catégories dérivées des produits réels + liste de base (ordre alphabétique)
  const derivedCategories = useMemo(() => {
    const set = new Set(CATEGORIES);
    products.forEach(p => { if (p.category?.trim()) set.add(p.category.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, dateLocale()));
  }, [products]);

  // Filtre recherche
  const displayed = products.filter(p => {
    // Nom, code-barres, catégorie, sous-catégorie et statut de stock
    // (« rupture », « stock bas ») — insensible aux accents
    const q = search.trim();
    return !q ||
      contientTexte(p.name, q) ||
      contientTexte(p.barcode, q) ||
      contientTexte(p.category, q) ||
      contientTexte(p.subCategory, q) ||
      matchesStockStatus(p, q);
  });

  const handleSave = async (payload: ProductPayload) => {
    const created = await createProduct(payload);
    setProducts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setShowModal(false);
    flash(t(`Produit "${created.name}" ajouté`, `Product "${created.name}" added`));
  };

  const handleSaveExisting = async (id: string, payload: Partial<ProductPayload>) => {
    const updated = await updateProduct(id, payload);
    setProducts(prev => prev.map(p => p._id === id ? updated : p));
    setShowModal(false);
    flash(t(`Produit "${updated.name}" mis à jour`, `Product "${updated.name}" updated`));
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* Modal ajout */}
      {showModal && (
        <AddModal baseCategories={derivedCategories} existingProducts={products} onSave={handleSave} onSaveExisting={handleSaveExisting} onClose={() => setShowModal(false)} />
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 flex items-center
        justify-between px-6 py-3 shrink-0 shadow-sm">
        <h2 className="font-bold text-bordeaux text-lg">{t('Produits', 'Products')}</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-bordeaux hover:bg-bordeaux-dark
            text-cream text-sm font-bold px-4 py-2 rounded-xl
            border-2 border-gold transition-colors"
        >
          <span>+</span> {t('Ajouter un produit', 'Add a product')}
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
          placeholder={t('Rechercher par nom, code-barres, catégorie, « rupture », « stock bas »…', 'Search by name, barcode, category, “out of stock”, “low stock”…')}
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
                  {search ? t('Aucun produit trouvé', 'No product found') : t('Aucun produit — ajoutez-en un !', 'No product — add one!')}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse fs-grid">
                <thead>
                  <tr className="border-b border-gray-100 bg-cream/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      {t('Produit', 'Product')}
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      {t('Code-barres', 'Barcode')}
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      {t('Catégorie', 'Category')}
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      {t('Prix', 'Price')}
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold
                      text-gray-400 uppercase tracking-wider">
                      {t('Stock', 'Stock')}
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
                          {p.localName && <p className="text-xs text-gray-400 italic">{p.localName}</p>}
                          <p className="text-xs text-gray-400">{p.unit}{p.valeur ? ` · ${p.valeur}` : ''}</p>
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
                          {p.price.toLocaleString(dateLocale())} F
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
          {products.length} {t('produit', 'product')}{products.length > 1 ? 's' : ''} {t('au total', 'in total')}
        </p>
      </main>
    </div>
  );
}
