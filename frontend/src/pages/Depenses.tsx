import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CategoryStat,
  createExpense,
  deleteExpense,
  Expense,
  EXPENSE_CATEGORIES,
  getAllExpenses,
  getMonthStats,
  MonthStats,
} from '../api/expenses';
import ToastContainer, { useToast } from '../components/Toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' FCFA';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const today = () => new Date().toISOString().split('T')[0];

// Category color mapping
const CAT_COLORS: Record<string, string> = {
  'Loyer':         'bg-purple-100 text-purple-700 border-purple-200',
  'Électricité':   'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Fournisseur':   'bg-blue-100   text-blue-700   border-blue-200',
  'Salaires':      'bg-green-100  text-green-700  border-green-200',
  'Autre':         'bg-gray-100   text-gray-600   border-gray-200',
};
const catClass = (cat: string) => CAT_COLORS[cat] ?? CAT_COLORS['Autre'];

// ── Empty form state ──────────────────────────────────────────────────────────

interface FormState {
  amount: string;
  category: string;
  description: string;
  date: string;
}

const EMPTY_FORM: FormState = {
  amount:      '',
  category:    EXPENSE_CATEGORIES[0],
  description: '',
  date:        today(),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Depenses() {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [stats, setStats]         = useState<MonthStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, monthStats] = await Promise.all([getAllExpenses(), getMonthStats()]);
      setExpenses(list);
      setStats(monthStats);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Form ───────────────────────────────────────────────────────────────────
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const setField = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      setFormError('Montant invalide');
      return;
    }
    if (!form.category) {
      setFormError('Catégorie requise');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createExpense({
        amount,
        category:    form.category,
        description: form.description.trim() || undefined,
        date:        form.date || today(),
      });
      setExpenses(prev => [created, ...prev]);
      // refresh stats
      getMonthStats().then(setStats).catch(() => {});
      setForm({ ...EMPTY_FORM, date: today() });
      addToast(`Dépense de ${fmt(amount)} enregistrée`, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur ajout', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, amount: number) => {
    setDeletingId(id);
    try {
      await deleteExpense(id);
      setExpenses(prev => prev.filter(e => e._id !== id));
      getMonthStats().then(setStats).catch(() => {});
      addToast(`Dépense de ${fmt(amount)} supprimée`, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Erreur suppression', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentMonth = new Date().toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen flex flex-col bg-cream">

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Header ── */}
      <header className="bg-bordeaux flex items-center justify-between px-6 py-3 shadow-lg shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-cream/50 hover:text-cream mr-2 transition-colors text-xl leading-none"
          >
            ←
          </button>
          <span className="text-xl font-black tracking-widest text-cream">FAMILY</span>
          <span className="text-xl font-black tracking-widest text-gold">STORE</span>
          <span className="ml-3 pl-3 border-l border-cream/20 text-cream/60 text-sm font-medium">
            Dépenses
          </span>
        </div>
        <span className="text-cream/50 text-sm hidden md:block capitalize">{currentMonth}</span>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 flex flex-col gap-6">

        {/* ── Stats du mois ── */}
        {stats && (
          <section>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Bilan du mois — {currentMonth}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              {/* Total général */}
              <div className="sm:col-span-2 lg:col-span-1 bg-white rounded-2xl p-5 shadow border border-cream-dark
                flex flex-col justify-between gap-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total dépenses</p>
                <p className="text-3xl font-black text-bordeaux leading-none">
                  {fmt(stats.total)}
                </p>
                <p className="text-xs text-gray-400">{stats.count} dépense{stats.count > 1 ? 's' : ''}</p>
              </div>

              {/* Par catégorie */}
              {stats.categories.map(cat => (
                <CategoryCard key={cat.category} cat={cat} total={stats.total} />
              ))}
            </div>
          </section>
        )}

        {/* ── Main grid: formulaire + liste ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* ── Formulaire ── */}
          <section className="bg-white rounded-2xl shadow border border-cream-dark overflow-hidden">
            <div className="bg-bordeaux/5 border-b border-bordeaux/15 px-5 py-3">
              <h2 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
                Nouvelle dépense
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">

              {/* Montant */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Montant (FCFA) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.amount}
                    onChange={e => setField('amount', e.target.value)}
                    placeholder="0"
                    required
                    className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-bordeaux/25
                      focus:border-bordeaux outline-none text-lg font-bold transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2
                    text-gray-400 text-sm font-medium pointer-events-none">
                    FCFA
                  </span>
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Catégorie *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setField('category', cat)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium
                        transition-all text-left
                        ${form.category === cat
                          ? 'bg-bordeaux text-cream border-bordeaux shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-bordeaux/40 hover:bg-cream'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="Détails optionnels…"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200
                    focus:border-bordeaux outline-none text-sm transition-colors"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200
                    focus:border-bordeaux outline-none text-sm transition-colors"
                />
              </div>

              {/* Form error */}
              {formError && (
                <p className="text-red-600 text-sm flex items-center gap-1.5">
                  <span>✕</span>{formError}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-bordeaux text-cream font-black text-sm
                  rounded-xl border-2 border-gold tracking-widest uppercase
                  hover:bg-bordeaux-dark transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed shadow-md mt-1"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-cream/40 border-t-cream
                      rounded-full animate-spin" />
                    Enregistrement…
                  </span>
                ) : (
                  'Enregistrer la dépense'
                )}
              </button>
            </form>
          </section>

          {/* ── Liste des dépenses ── */}
          <section className="bg-white rounded-2xl shadow border border-cream-dark overflow-hidden">
            <div className="bg-bordeaux/5 border-b border-bordeaux/15 px-5 py-3 flex items-center justify-between">
              <h2 className="font-bold text-bordeaux text-sm uppercase tracking-widest">
                Historique
              </h2>
              {!loading && (
                <span className="text-xs text-gray-400">
                  {expenses.length} dépense{expenses.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="px-5 py-10 text-center text-gray-300">
                <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-bordeaux
                  rounded-full animate-spin mb-2" />
                <p className="text-sm">Chargement…</p>
              </div>
            )}

            {/* Error */}
            {loadError && (
              <div className="m-4 bg-red-50 border border-red-200 text-red-700 rounded-xl
                px-4 py-3 text-sm flex items-center gap-2">
                <span>✕</span>
                <span>{loadError}</span>
                <button onClick={loadData} className="ml-auto underline text-xs">
                  Réessayer
                </button>
              </div>
            )}

            {/* Empty */}
            {!loading && !loadError && expenses.length === 0 && (
              <div className="px-5 py-10 text-center text-gray-300 flex flex-col items-center gap-2">
                <span className="text-4xl">💸</span>
                <span className="text-sm">Aucune dépense enregistrée</span>
              </div>
            )}

            {/* List */}
            {!loading && expenses.length > 0 && (
              <ul className="divide-y divide-gray-50 max-h-[560px] overflow-y-auto">
                {expenses.map(expense => (
                  <ExpenseRow
                    key={expense._id}
                    expense={expense}
                    deleting={deletingId === expense._id}
                    onDelete={() => handleDelete(expense._id, expense.amount)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── CategoryCard ──────────────────────────────────────────────────────────────

function CategoryCard({ cat, total }: { cat: CategoryStat; total: number }) {
  const pct = total > 0 ? Math.round((cat.total / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow border border-cream-dark flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${catClass(cat.category)}`}>
          {cat.category}
        </span>
        <span className="text-xs text-gray-400">{cat.count} op.</span>
      </div>
      <p className="text-xl font-black text-bordeaux leading-none">{fmt(cat.total)}</p>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-bordeaux rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 text-right">{pct}% du total</p>
    </div>
  );
}

// ── ExpenseRow ────────────────────────────────────────────────────────────────

function ExpenseRow({
  expense,
  deleting,
  onDelete,
}: {
  expense: Expense;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <li className={`flex items-center gap-3 px-5 py-3.5 hover:bg-cream/50 transition-colors
      ${deleting ? 'opacity-40 pointer-events-none' : ''}`}>

      {/* Date */}
      <div className="shrink-0 text-center w-12">
        <p className="text-base font-black text-bordeaux leading-none">
          {new Date(expense.date).getDate()}
        </p>
        <p className="text-xs text-gray-400 uppercase">
          {new Date(expense.date).toLocaleDateString('fr-FR', { month: 'short' })}
        </p>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-100 shrink-0" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${catClass(expense.category)}`}>
            {expense.category}
          </span>
          {expense.description && (
            <span className="text-sm text-gray-600 truncate">{expense.description}</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(expense.date)}</p>
      </div>

      {/* Amount */}
      <span className="font-black text-bordeaux text-base shrink-0">
        {expense.amount.toLocaleString('fr-FR')}
        <span className="text-xs font-normal text-gray-400 ml-0.5">FCFA</span>
      </span>

      {/* Delete */}
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          className="shrink-0 w-7 h-7 rounded-full text-gray-300 hover:text-red-500
            hover:bg-red-50 transition-colors flex items-center justify-center text-lg leading-none"
          title="Supprimer"
        >
          ×
        </button>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onDelete}
            className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg
              hover:bg-red-600 transition-colors font-semibold"
          >
            Oui
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg
              hover:bg-gray-200 transition-colors"
          >
            Non
          </button>
        </div>
      )}
    </li>
  );
}
