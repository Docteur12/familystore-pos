import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  Product,
  ProductPayload,
  updateProduct,
} from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS       = ['unité', 'kg', 'litre', 'sachet', 'boîte', 'carton', 'pack'];
const CATEGORIES  = ['Alimentation', 'Boisson', 'Hygiène', 'Ménage', 'Électronique', 'Autre'];
const EMPTY: ProductPayload = {
  name: '', barcode: '', price: 0, costPrice: 0,
  stock: 0, alertThreshold: 5, category: '', unit: 'unité',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';

function statusColor(p: Product) {
  if (p.stock === 0)                   return 'text-red-600 font-black';
  if (p.stock <= p.alertThreshold)     return 'text-amber-600 font-bold';
  return 'text-green-700 font-semibold';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Produits() {
  const { toasts, addToast, removeToast } = useToast();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [products,   setProducts]   = useState<Product[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProducts(await getAllProducts());
    } catch (e: any) {
      setLoadError(e.message ?? 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Modal form ─────────────────────────────────────────────────────────────
  const [modal,      setModal]      = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form,       setForm]       = useState<ProductPayload>(EMPTY);
  const [saving,     setSaving]     = useState(false);

  // Barcode scan ref — autofocus when modal opens
  const barcodeRef = useRef<HTMLInputElement>(null);
  const nameRef    = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY);
    setModal(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({
      name: p.name, barcode: p.barcode ?? '', price: p.price,
      costPrice: p.costPrice, stock: p.stock,
      alertThreshold: p.alertThreshold, category: p.category ?? '', unit: p.unit,
    });
    setModal(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  };

  const closeModal = () => { setModal(false); setEditTarget(null); };

  const setField = (k: keyof ProductPayload, v: string | number) =>
    setForm(prev => ({ ...prev, [k]: v }));

  // Barcode scan : Enter dans le champ → passe au champ suivant (nom)
  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameRef.current?.focus();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await updateProduct(editTarget._id, form);
        setProducts(prev => prev.map(p => p._id === updated._id ? updated : p));
        addToast(`"${updated.name}" mis à jour`, 'success');
      } else {
        const created = await createProduct(form);
        setProducts(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        addToast(`"${created.name}" ajouté au catalogue`, 'success');
      }
      closeModal();
    } catch (e: any) {
      addToast(e.message ?? 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`Supprimer "${p.name}" définitivement ?`)) return;
    setDeletingId(p._id);
    try {
      await deleteProduct(p._id);
      setProducts(prev => prev.filter(x => x._id !== p._id));
      addToast(`"${p.name}" supprimé`, 'success');
    } catch (e: any) {
      addToast(e.message ?? 'Erreur suppression', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const displayed = products.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-cream overflow-hidden">

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 flex items-center
        justify-between px-6 py-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-bordeaux text-lg">Produits</h2>
          {!loading && (
            <span className="bg-cream text-gray-500 text-xs font-semibold
              px-2 py-0.5 rounded-full border border-gray-200">
              {products.length}
            </span>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-bordeaux hover:bg-bordeaux-dark
            text-cream text-sm font-bold px-4 py-2 rounded-xl transition-colors
            border-2 border-gold shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          <span>Nouveau produit</span>
        </button>
      </header>

      {/* ── Search bar ── */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, code-barres ou catégorie…"
          className="w-full max-w-md px-4 py-2.5 rounded-xl border-2 border-gray-200
            focus:border-bordeaux outline-none text-sm bg-white transition-colors"
        />
      </div>

      {/* ── Error ── */}
      {loadError && (
        <div className="mx-6 mb-2 bg-red-50 border border-red-200 text-red-700
          rounded-xl px-4 py-2 text-sm flex items-center gap-2">
          <span>✕</span>{loadError}
          <button onClick={load} className="ml-auto underline text-xs">Réessayer</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-gray-200 border-t-bordeaux
              rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40
            text-gray-300 gap-2">
            <span className="text-5xl">🏷️</span>
            <span className="text-sm">
              {search ? 'Aucun résultat' : 'Catalogue vide — ajoutez un produit'}
            </span>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {['Produit', 'Code-barres', 'Catégorie', 'Prix vente',
                  "Coût d'achat", 'Stock', 'Seuil', ''].map(h => (
                  <th key={h} className="pb-3 pt-1 text-left text-xs text-gray-400
                    uppercase tracking-wider font-semibold pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(p => (
                <tr key={p._id} className="hover:bg-white transition-colors group">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-gray-800 leading-tight">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.unit}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100
                      px-2 py-0.5 rounded">
                      {p.barcode || '—'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">
                    {p.category || '—'}
                  </td>
                  <td className="py-3 pr-4 font-bold text-bordeaux text-sm">
                    {fmt(p.price)}
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">
                    {fmt(p.costPrice)}
                  </td>
                  <td className={`py-3 pr-4 text-base ${statusColor(p)}`}>
                    {p.stock}
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">
                    {p.alertThreshold}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5 opacity-0
                      group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-cream
                          hover:bg-bordeaux/10 text-bordeaux border border-bordeaux/20
                          font-medium transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p._id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-50
                          hover:bg-red-100 text-red-600 border border-red-200
                          font-medium transition-colors disabled:opacity-40"
                      >
                        {deletingId === p._id ? '…' : 'Supprimer'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center
            bg-black/40 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg
            max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="bg-bordeaux px-6 py-4 rounded-t-2xl flex items-center
              justify-between">
              <div>
                <p className="text-cream font-black text-sm tracking-widest uppercase">
                  {editTarget ? 'Modifier le produit' : 'Nouveau produit'}
                </p>
                {editTarget && (
                  <p className="text-gold text-xs mt-0.5">{editTarget.name}</p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-cream/60 hover:text-cream text-xl leading-none
                  transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">

              {/* Code-barres — scan first */}
              <F label="Code-barres (scan ou saisie)">
                <div className="relative">
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={form.barcode ?? ''}
                    onChange={e => setField('barcode', e.target.value)}
                    onKeyDown={handleBarcodeScan}
                    placeholder="Scannez ou tapez le code-barres → Entrée"
                    className={cx}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2
                    text-gray-300 text-xs select-none pointer-events-none">
                    ↵
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Appuyez sur Entrée après le scan pour passer au nom
                </p>
              </F>

              {/* Nom */}
              <F label="Nom du produit *">
                <input
                  ref={nameRef}
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Ex: Huile Végétale Diamaor 1L"
                  className={cx}
                />
              </F>

              {/* Catégorie + Unité */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Catégorie">
                  <select value={form.category ?? ''}
                    onChange={e => setField('category', e.target.value)}
                    className={cx}>
                    <option value="">— Aucune —</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Unité *">
                  <select required value={form.unit}
                    onChange={e => setField('unit', e.target.value)}
                    className={cx}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </F>
              </div>

              {/* Prix vente + Coût */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Prix de vente (FCFA) *">
                  <input required type="number" min={0} value={form.price}
                    onChange={e => setField('price', Number(e.target.value))}
                    className={cx} />
                </F>
                <F label="Coût d'achat (FCFA) *">
                  <input required type="number" min={0} value={form.costPrice}
                    onChange={e => setField('costPrice', Number(e.target.value))}
                    className={cx} />
                </F>
              </div>

              {/* Marge auto */}
              {form.price > 0 && form.costPrice >= 0 && (
                <div className="bg-cream/60 border border-cream-dark rounded-xl
                  px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Marge bénéficiaire</span>
                  <span className={`font-bold ${
                    form.price > form.costPrice ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {form.price > 0
                      ? Math.round(((form.price - form.costPrice) / form.price) * 100)
                      : 0}%
                    &nbsp;({(form.price - form.costPrice).toLocaleString('fr-FR')} FCFA)
                  </span>
                </div>
              )}

              {/* Stock + Seuil */}
              <div className="grid grid-cols-2 gap-3">
                <F label="Stock initial">
                  <input type="number" min={0} value={form.stock}
                    onChange={e => setField('stock', Number(e.target.value))}
                    className={cx} />
                </F>
                <F label="Seuil d'alerte">
                  <input type="number" min={0} value={form.alertThreshold}
                    onChange={e => setField('alertThreshold', Number(e.target.value))}
                    className={cx} />
                </F>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm
                    text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-bordeaux hover:bg-bordeaux-dark text-cream
                    font-black text-sm rounded-xl border-2 border-gold transition-colors
                    disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-cream/30 border-t-cream
                      rounded-full animate-spin" />
                  )}
                  {editTarget ? 'Enregistrer les modifications' : 'Ajouter au catalogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase
        tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const cx = `w-full px-3 py-2.5 rounded-xl border-2 border-gray-200
  focus:border-bordeaux outline-none text-sm bg-cream/40 transition-colors`;
