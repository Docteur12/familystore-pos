import { displayName } from '../utils/text';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useIsMobile';
import { getSales, deleteSale, modifierVente, Sale, PM_LABELS } from '../api/sales';
import { t, dateLocale } from '../i18n';
import { getAllProducts, effectivePrice, Product } from '../api/products';
import { contientTexte } from '../utils/text';
import { localISODate } from '../utils/dates';
import { buildReceiptHTML, doPrint, getPrintSettings, ReceiptData } from '../components/ReceiptPrint';
import { useSettings } from '../contexts/SettingsContext';
import { storeIdentity } from '../api/settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtN = (n: number) => Math.round(n).toLocaleString(dateLocale());

function fmtDatetime(iso: string) {
  const d = new Date(iso);
  return {
    date:  d.toLocaleDateString(dateLocale()),
    heure: d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }),
  };
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return t('À l\'instant', 'Just now');
  if (diff < 3600)  return t(`Il y a ${Math.floor(diff / 60)} min`, `${Math.floor(diff / 60)} min ago`);
  if (diff < 86400) return t(`Il y a ${Math.floor(diff / 3600)} h`, `${Math.floor(diff / 3600)} h ago`);
  return t(`Il y a ${Math.floor(diff / 86400)} j`, `${Math.floor(diff / 86400)} d ago`);
}

// ── SVG Icon ──────────────────────────────────────────────────────────────────

function I({ d, size = 13 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

// ── Icône mode paiement ───────────────────────────────────────────────────────

const PM_ICONS: Record<string, string> = {
  cash:          'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  mtn_momo:      'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  orange_money:  'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  mobile_money:  'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  card:          'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  credit:        'M9 14l6-6M9.5 8.5a.5.5 0 10-.001 1 .5.5 0 000-1zM14.5 13.5a.5.5 0 10-.001 1 .5.5 0 000-1zM3 10h18M7 15h1',
};

const PM_COLORS: Record<string, { bg: string; color: string }> = {
  cash:         { bg: '#E8F0E5', color: '#3F6B3A' },
  mtn_momo:     { bg: '#FFF3CD', color: '#7A5A00' },
  orange_money:  { bg: '#FFE8D4', color: '#7A3700' },
  mobile_money:  { bg: '#EEF3FA', color: '#3A5E8F' },
  card:          { bg: '#EDE7F6', color: '#5E35B1' },
  credit:        { bg: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)' },
};

const PAGE_SIZE = 50;

// ── Périodes ──────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'custom' | 'all';

function periodRange(
  p: Period,
  customFrom?: string,
  customTo?: string,
): { dateFrom?: string; dateTo?: string } {
  const now   = new Date();
  const start = new Date(now);

  if (p === 'today') {
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }
  if (p === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start.toISOString() };
  }
  if (p === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { dateFrom: start.toISOString() };
  }
  if (p === 'custom') {
    const from = customFrom ? new Date(customFrom + 'T00:00:00') : undefined;
    const to   = customTo   ? new Date(customTo   + 'T23:59:59') : undefined;
    return {
      dateFrom: from?.toISOString(),
      dateTo:   to?.toISOString(),
    };
  }
  return {}; // all
}

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'today',  label: t("Aujourd'hui", 'Today') },
  { key: 'week',   label: t('Cette semaine', 'This week') },
  { key: 'month',  label: t('Ce mois', 'This month') },
  { key: 'custom', label: t('Plage dates', 'Date range') },
  { key: 'all',    label: t('Tout', 'All') },
];

type JSortKey = 'ticket' | 'date' | 'cashier' | 'articles' | 'pm' | 'paye' | 'total';

const JOURNAL_COLS: { key: JSortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'ticket',   label: t('Ticket #', 'Receipt #'),          align: 'left' },
  { key: 'date',     label: t('Date · Heure', 'Date · Time'),    align: 'left' },
  { key: 'cashier',  label: t('Caissière', 'Cashier'),           align: 'left' },
  { key: 'articles', label: t('Articles', 'Items'),              align: 'left' },
  { key: 'pm',       label: t('Mode paiement', 'Payment method'), align: 'left' },
  { key: 'paye',     label: t('Montant payé', 'Amount paid'),    align: 'right' },
  { key: 'total',    label: 'Total',         align: 'right' },
];

const journalSortVal = (s: Sale, key: JSortKey): string | number => {
  switch (key) {
    case 'ticket':   return s._id;
    case 'date':     return new Date(s.dateVente ?? s.createdAt).getTime();
    case 'cashier':  return s.cashierName ?? '';
    case 'articles': return s.items.reduce((n, it) => n + it.quantity, 0);
    case 'pm':       return PM_LABELS[s.paymentMethod] ?? s.paymentMethod;
    case 'paye':     return s.amountPaid;
    case 'total':    return s.total;
  }
};

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportCSV(sales: Sale[]) {
  const header = t(
    'Date;Heure;Ticket #;Mode de paiement;Nb articles;Montant payé;Monnaie rendue;Total XAF',
    'Date;Time;Receipt #;Payment method;No. of items;Amount paid;Change given;Total XAF',
  );
  const rows = sales.map(s => {
    const { date, heure } = fmtDatetime(s.dateVente ?? s.createdAt);
    const nbArt = s.items.reduce((n, it) => n + it.quantity, 0);
    return [
      date, heure,
      s._id.slice(-6).toUpperCase(),
      PM_LABELS[s.paymentMethod] ?? s.paymentMethod,
      nbArt,
      s.amountPaid,
      s.change,
      s.total,
    ].join(';');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = t(`journal-ventes-${new Date().toISOString().slice(0, 10)}.csv`, `sales-journal-${new Date().toISOString().slice(0, 10)}.csv`);
  a.click();
  URL.revokeObjectURL(url);
}

// ── Ligne détail ticket (expandable) ─────────────────────────────────────────

function TicketDetail({ sale }: { sale: Sale }) {
  const benefice = sale.items.reduce((s, it) => {
    const cost = typeof it.product === 'object' ? (it.product.costPrice ?? 0) : 0;
    return s + (it.unitPrice - cost) * it.quantity;
  }, 0);

  return (
    <tr>
      <td colSpan={9} style={{ background: 'var(--fs-ivory)', padding: '0 0 2px' }}>
        <div style={{ margin: '0 48px 10px', border: '1px solid var(--fs-line)', borderRadius: 8, overflow: 'hidden' }}>
          <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--fs-wine-50)' }}>
                {[t('Article', 'Item'), t('Qté', 'Qty'), t('Prix unit.', 'Unit price'), t('Sous-total', 'Subtotal')].map((h, i) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: i >= 1 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it, idx) => (
                <tr key={idx} style={{ borderTop: '1px solid var(--fs-line)', background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                  <td style={{ padding: '6px 12px', fontSize: 12, color: 'var(--fs-ink-800)' }}>{displayName(it.name)}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>×{it.quantity}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-600)' }}>{fmtN(it.unitPrice)} XAF</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{fmtN(it.unitPrice * it.quantity)} XAF</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 24, padding: '8px 12px', background: 'var(--fs-wine-50)', borderTop: '1px solid var(--fs-line)' }}>
            {(sale.offreAmt ?? 0) > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fs-danger-700)', fontWeight: 700 }}>
                {t('Sous-total :', 'Subtotal:')} {fmtN(sale.subtotal || sale.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0))} XAF
                &nbsp;·&nbsp; {t('Réduction facture', 'Invoice discount')}{(sale.offrePct ?? 0) > 0 ? ` (−${sale.offrePct} %)` : ''} : −{fmtN(sale.offreAmt ?? 0)} XAF
              </span>
            )}
            {benefice > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fs-success-700)', fontWeight: 600 }}>
                {t('Marge :', 'Margin:')} {fmtN(benefice)} XAF
              </span>
            )}
            {sale.change > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fs-ink-500)' }}>
                {t('Monnaie rendue :', 'Change given:')} <strong>{fmtN(sale.change)} XAF</strong>
              </span>
            )}
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>
              {t('Total :', 'Total:')} {fmtN(sale.total)} XAF
            </span>
          </div>

          {/* Historique des corrections — sans ça, une vente réécrite serait
              indiscernable d'une vente d'origine. */}
          {(sale.modifications?.length ?? 0) > 0 && (
            <div style={{ borderTop: '1px solid var(--fs-line)', background: '#FFFBEB', padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#92400E', marginBottom: 5 }}>
                {t('Corrections', 'Corrections')} ({sale.modifications!.length})
              </div>
              {sale.modifications!.map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--fs-ink-700)', lineHeight: 1.6 }}>
                  <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>
                    {fmtN(m.ancienTotal)} → {fmtN(m.nouveauTotal)} XAF
                  </strong>
                  {' · '}{m.motif}
                  {' · '}<span style={{ color: 'var(--fs-ink-400)' }}>
                    {m.parNom || '—'}, {new Date(m.date).toLocaleString(dateLocale())}
                  </span>
                  <span style={{ color: 'var(--fs-ink-400)' }}>
                    {' · '}{t('avant', 'before')} : {m.anciensItems.map(a => `${displayName(a.name)} ×${a.quantity}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Correction d'une vente (le client revient avec son ticket) ───────────────
//
// Réservé au patron. Les montants affichés ici sont indicatifs : c'est le
// serveur qui recalcule et qui fait foi. Le stock est ajusté au delta de chaque
// ligne, et l'état d'avant est conservé sur la vente.

interface LigneEdit { product?: string; divers: boolean; name: string; quantity: number; unitPrice: number }

function ModifierVenteModal({ sale, onClose, onSaved, imprimer }: {
  sale: Sale;
  onClose: () => void;
  onSaved: (maj: Sale, ancienTotal: number, nouveauTotal: number) => void;
  imprimer: (s: Sale) => void;
}) {
  // Catalogue chargé à l'ouverture : sert à AJOUTER un article au ticket
  // (le client repart avec autre chose en échange de ce qu'il rend).
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [recherche, setRecherche] = useState('');
  useEffect(() => { getAllProducts().then(setCatalogue).catch(() => {}); }, []);
  const [imprimerApres, setImprimerApres] = useState(true);
  const [lignes, setLignes] = useState<LigneEdit[]>(() => sale.items.map(it => ({
    product:   typeof it.product === 'object' ? it.product?._id : (it.product as string | undefined),
    divers:    it.divers ?? false,
    name:      it.name,
    quantity:  it.quantity,
    unitPrice: it.unitPrice,
  })));
  const [offrePct,  setOffrePct]  = useState<number>(sale.offrePct ?? 0);
  const [pm,        setPm]        = useState<string>(sale.paymentMethod);
  const [paid,      setPaid]      = useState<number>(sale.amountPaid);
  const [motif,     setMotif]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [erreur,    setErreur]    = useState<string | null>(null);

  const sousTotal = lignes.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const remise    = Math.round(sousTotal * offrePct / 100);
  const total     = sousTotal - remise;
  const rendu     = Math.max(0, paid - total);
  const ecart     = total - sale.total;   // < 0 = à rembourser au client

  const majLigne = (i: number, patch: Partial<LigneEdit>) =>
    setLignes(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  // Résultats de recherche : on masque ce qui est déjà sur le ticket pour éviter
  // les doublons (une deuxième ligne du même produit fausserait la lecture).
  const resultats = recherche.trim().length < 2 ? [] : catalogue
    .filter(p => contientTexte(p.name, recherche) || contientTexte(p.barcode, recherche))
    .filter(p => !lignes.some(l => l.product === p._id))
    .slice(0, 6);

  const ajouterProduit = (p: Product) => {
    setLignes(ls => [...ls, {
      product: p._id, divers: false, name: p.name, quantity: 1, unitPrice: effectivePrice(p),
    }]);
    setRecherche('');
  };

  const motifValide = motif.trim().length >= 5;
  const paiementOk  = pm === 'credit' || paid >= total;
  const peutValider = lignes.length > 0 && motifValide && paiementOk && !busy;

  const enregistrer = async () => {
    setErreur(null);
    setBusy(true);
    try {
      const res = await modifierVente(sale._id, {
        items: lignes.map(l => ({
          ...(l.product && !l.divers ? { product: l.product } : {}),
          ...(l.divers ? { divers: true } : {}),
          name: l.name, quantity: l.quantity, unitPrice: l.unitPrice,
        })),
        offrePct, paymentMethod: pm, amountPaid: paid, motif: motif.trim(),
      });
      if (imprimerApres) imprimer(res.sale);
      onSaved(res.sale, res.ancienTotal, res.nouveauTotal);
    } catch (e: unknown) {
      setErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  const champ: React.CSSProperties = {
    border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '7px 10px',
    fontSize: 13, fontFamily: 'var(--fs-font-sans)', width: '100%', color: 'var(--fs-ink-900)',
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 420, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '22px 26px', maxWidth: 640, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 2 }}>
          {t('Corriger la vente', 'Correct the sale')} #{sale._id.slice(-6).toUpperCase()}
        </div>
        <p style={{ fontSize: 12, color: 'var(--fs-ink-500)', margin: '0 0 14px' }}>
          {t('Le stock est réajusté automatiquement et la correction est tracée (auteur, motif, état d’avant).',
             'Stock is adjusted automatically and the correction is logged (author, reason, previous state).')}
        </p>

        {/* Lignes */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead>
            <tr style={{ background: 'var(--fs-wine-50)' }}>
              {[t('Article', 'Item'), t('Qté', 'Qty'), t('Prix unit.', 'Unit price'), t('Total', 'Total'), ''].map((h, i) => (
                <th key={i} style={{ padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: 'var(--fs-wine-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--fs-line)' }}>
                <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--fs-ink-800)' }}>{displayName(l.name)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <input type="number" min={1} value={l.quantity} disabled={busy}
                    onChange={e => majLigne(i, { quantity: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                    style={{ ...champ, width: 64, textAlign: 'right', padding: '5px 7px' }}/>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <input type="number" min={0} value={l.unitPrice} disabled={busy}
                    onChange={e => majLigne(i, { unitPrice: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                    style={{ ...champ, width: 92, textAlign: 'right', padding: '5px 7px' }}/>
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)' }}>
                  {fmtN(l.unitPrice * l.quantity)}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                  <button onClick={() => setLignes(ls => ls.filter((_, idx) => idx !== i))}
                    disabled={busy || lignes.length === 1}
                    title={lignes.length === 1
                      ? t('Une vente doit garder au moins une ligne — utilisez la suppression', 'A sale must keep at least one line — use deletion instead')
                      : t('Retirer cette ligne', 'Remove this line')}
                    style={{ background: 'none', border: 'none', cursor: lignes.length === 1 ? 'not-allowed' : 'pointer', color: lignes.length === 1 ? 'var(--fs-ink-300)' : 'var(--fs-danger-700)', fontSize: 15, lineHeight: 1 }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Ajout d'un article au ticket */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} disabled={busy}
            placeholder={t('+ Ajouter un article (nom ou code-barres)', '+ Add an item (name or barcode)')}
            style={{ ...champ, borderStyle: 'dashed' }}/>
          {resultats.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, background: '#fff', border: '1px solid var(--fs-line-2)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 3, overflow: 'hidden' }}>
              {resultats.map(p => (
                <button key={p._id} onClick={() => ajouterProduit(p)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%', border: 'none', borderBottom: '1px solid var(--fs-line)', background: 'none', padding: '8px 10px', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontFamily: 'var(--fs-font-sans)' }}>
                  <span style={{ color: 'var(--fs-ink-800)' }}>
                    {displayName(p.name)}
                    <span style={{ color: p.stock > 0 ? 'var(--fs-ink-400)' : 'var(--fs-danger-700)', marginLeft: 6 }}>
                      ({t('stock', 'stock')} {p.stock})
                    </span>
                  </span>
                  <span style={{ fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)', whiteSpace: 'nowrap' }}>{fmtN(effectivePrice(p))} XAF</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Paiement */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ flex: '1 1 120px', fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)' }}>
            {t('Réduction facture (%)', 'Invoice discount (%)')}
            <input type="number" min={0} max={100} value={offrePct} disabled={busy}
              onChange={e => setOffrePct(Math.min(100, Math.max(0, parseInt(e.target.value || '0', 10))))}
              style={{ ...champ, marginTop: 3 }}/>
          </label>
          <label style={{ flex: '1 1 150px', fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)' }}>
            {t('Mode de paiement', 'Payment method')}
            <select value={pm} onChange={e => setPm(e.target.value)} disabled={busy} style={{ ...champ, marginTop: 3 }}>
              {Object.entries(PM_LABELS).map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
            </select>
          </label>
          <label style={{ flex: '1 1 130px', fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)' }}>
            {t('Montant remis', 'Amount paid')}
            <input type="number" min={0} value={paid} disabled={busy}
              onChange={e => setPaid(Math.max(0, parseInt(e.target.value || '0', 10)))}
              style={{ ...champ, marginTop: 3 }}/>
          </label>
        </div>

        {/* Totaux */}
        <div style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
          {[
            [t('Sous-total', 'Subtotal'), `${fmtN(sousTotal)} XAF`],
            ...(remise > 0 ? [[`${t('Réduction', 'Discount')} (−${offrePct} %)`, `−${fmtN(remise)} XAF`]] : []),
            [t('Nouveau total', 'New total'), `${fmtN(total)} XAF`],
            [t('Monnaie à rendre', 'Change to give'), `${fmtN(rendu)} XAF`],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: k === t('Nouveau total', 'New total') ? 800 : 500, color: 'var(--fs-ink-800)' }}>
              <span>{k}</span><span style={{ fontFamily: 'var(--fs-font-mono)' }}>{v}</span>
            </div>
          ))}
          {ecart !== 0 && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--fs-line)', fontWeight: 800, color: ecart < 0 ? 'var(--fs-danger-700)' : '#15803d' }}>
              {ecart < 0
                ? `${t('À rembourser au client', 'To refund the customer')} : ${fmtN(-ecart)} XAF`
                : `${t('Complément à encaisser', 'Extra to collect')} : ${fmtN(ecart)} XAF`}
            </div>
          )}
        </div>

        {/* Motif — obligatoire */}
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)' }}>
          {t('Motif de la correction (obligatoire)', 'Reason for the correction (required)')}
          <input value={motif} onChange={e => setMotif(e.target.value)} disabled={busy}
            placeholder={t('Ex. : client a rendu 1 savon', 'E.g. customer returned 1 soap')}
            style={{ ...champ, marginTop: 3, borderColor: motif && !motifValide ? 'var(--fs-danger-700)' : 'var(--fs-line-2)' }}/>
        </label>
        {motif.length > 0 && !motifValide && (
          <div style={{ fontSize: 11, color: 'var(--fs-danger-700)', marginTop: 4 }}>{t('5 caractères minimum.', 'At least 5 characters.')}</div>
        )}
        {!paiementOk && (
          <div style={{ fontSize: 11, color: 'var(--fs-danger-700)', marginTop: 6 }}>
            {t('Le montant remis est inférieur au nouveau total.', 'The amount paid is lower than the new total.')}
          </div>
        )}
        {erreur && (
          <div style={{ fontSize: 12, color: 'var(--fs-danger-700)', background: '#fef2f2', border: '1px solid rgba(194,62,36,0.25)', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>{erreur}</div>
        )}

        {/* Impression du ticket corrigé — au choix */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: 'var(--fs-ink-700)', cursor: 'pointer' }}>
          <input type="checkbox" checked={imprimerApres} onChange={e => setImprimerApres(e.target.checked)} disabled={busy}
            style={{ width: 15, height: 15, accentColor: 'var(--fs-wine-700)', cursor: 'pointer' }}/>
          {t('Imprimer le ticket corrigé après enregistrement', 'Print the corrected receipt after saving')}
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} disabled={busy}
            style={{ flex: 1, padding: '11px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
            {t('Annuler', 'Cancel')}
          </button>
          <button onClick={enregistrer} disabled={!peutValider}
            style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: peutValider ? 'pointer' : 'not-allowed', background: peutValider ? 'var(--fs-wine-700)' : 'var(--fs-line-2)', color: '#fff', fontFamily: 'var(--fs-font-sans)' }}>
            {busy ? t('Enregistrement…', 'Saving…') : t('Enregistrer la correction', 'Save correction')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminJournal() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);
  const { settings } = useSettings();

  /**
   * Réimpression d'un ticket depuis le journal (client au comptoir).
   * Un ticket déjà corrigé sort avec la mention « TICKET CORRIGÉ » : un
   * duplicata muet pourrait servir à réclamer deux fois le même achat.
   */
  const imprimerTicket = useCallback((s: Sale) => {
    const d = new Date(s.dateVente ?? s.createdAt);
    const data: ReceiptData = {
      receiptNo:    `FSV-${localISODate(d).replace(/-/g, '')}-${s._id.slice(-6).toUpperCase()}`,
      date:         d,
      cashierName:  s.cashierName ?? '',
      storePhone:   settings.telephone || undefined,
      store:        storeIdentity(settings),
      items:        s.items.map(it => ({ name: it.name, unit: '', quantity: it.quantity, unitPrice: it.unitPrice })),
      subtotal:     s.subtotal || s.items.reduce((n, it) => n + it.unitPrice * it.quantity, 0),
      total:        s.total,
      paymentLabel: PM_LABELS[s.paymentMethod] ?? s.paymentMethod,
      amountPaid:   s.amountPaid,
      change:       s.change,
      offrePct:     s.offrePct,
      offreAmt:     s.offreAmt,
      mention:      (s.modifications?.length ?? 0) > 0 ? t('TICKET CORRIGÉ', 'CORRECTED RECEIPT') : undefined,
    };
    doPrint(buildReceiptHTML(data), getPrintSettings().copies);
  }, [settings]);

  const [sales,        setSales]        = useState<Sale[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [period,       setPeriod]       = useState<Period>('today');
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [lastRefresh,  setLastRefresh]  = useState<Date>(new Date());
  const [page,         setPage]         = useState(0);
  const [customFrom,   setCustomFrom]   = useState('');
  const [customTo,     setCustomTo]     = useState('');
  const [cashierFilter,setCashierFilter]= useState('');
  const [sort,         setSort]         = useState<{ key: JSortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [editTarget,   setEditTarget]   = useState<Sale | null>(null);
  const [motifSuppr,   setMotifSuppr]   = useState('');
  const [deleting,     setDeleting]     = useState(false);
  const toggleSort = useCallback((key: JSortKey) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(0);
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const range = periodRange(period, customFrom, customTo);
      const data  = await getSales(range);
      setSales(data);
      setLastRefresh(new Date());
      if (!silent) setPage(0); // reset page on manual reload
    } catch {
      if (!silent) addToast(t('Erreur chargement des ventes', 'Error loading sales'), 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [period, customFrom, customTo, addToast]);

  useEffect(() => {
    setPage(0);
    load();
    timerRef.current = setInterval(() => load(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const handleDeleteSale = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSale(deleteTarget._id, motifSuppr.trim());
      setSales(prev => prev.filter(s => s._id !== deleteTarget._id));
      setDeleteTarget(null);
      setMotifSuppr('');
      addToast(t('Vente supprimée — stock restauré ✓', 'Sale deleted — stock restored ✓'), 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : t('Erreur', 'Error'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtrage local (recherche + caissière) ───────────────────────────────

  const cf = cashierFilter;
  const filtered = sales.filter(s =>
    !cf || (s.cashierName ?? '') === cf,
  );

  // Tri par colonne
  const sortDir = sort.dir === 'asc' ? 1 : -1;
  const sortedFiltered = [...filtered].sort((a, b) => {
    const va = journalSortVal(a, sort.key);
    const vb = journalSortVal(b, sort.key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
    return String(va).localeCompare(String(vb), dateLocale()) * sortDir;
  });

  // ── Liste caissières (depuis TOUTES les ventes, pas les filtrées) ──────────

  const allCashiers = Array.from(
    new Set(sales.map(s => s.cashierName).filter(Boolean))
  ).sort((a, b) => (a ?? '').localeCompare(b ?? '', dateLocale())) as string[];

  // ── Stats par caissière ──────────────────────────────────────────────────

  const byCashier: Record<string, { nbVentes: number; ca: number }> = {};
  for (const s of filtered) {
    const name = s.cashierName || t('Inconnu', 'Unknown');
    if (!byCashier[name]) byCashier[name] = { nbVentes: 0, ca: 0 };
    byCashier[name].nbVentes++;
    byCashier[name].ca += s.total;
  }
  const cashierList = Object.entries(byCashier).sort((a, b) => b[1].ca - a[1].ca);

  // ── Stats (sur tous les filtrés, pas juste la page) ──────────────────────

  const totalCA  = filtered.reduce((s, x) => s + x.total, 0);
  const nbArt    = filtered.reduce((s, x) => s + x.items.reduce((n, it) => n + it.quantity, 0), 0);

  const byPm: Record<string, number> = {};
  for (const s of filtered) {
    byPm[s.paymentMethod] = (byPm[s.paymentMethod] ?? 0) + s.total;
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  const pages    = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const paginated = sortedFiltered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── Toggle ligne détail ────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar />
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modal confirmation suppression de vente */}
      {editTarget && (
        <ModifierVenteModal
          sale={editTarget}
          onClose={() => setEditTarget(null)}
          imprimer={imprimerTicket}
          onSaved={(maj, ancien, nouveau) => {
            setSales(prev => prev.map(s => s._id === maj._id ? maj : s));
            setEditTarget(null);
            const ecart = nouveau - ancien;
            addToast(
              ecart === 0
                ? t('Vente corrigée ✓', 'Sale corrected ✓')
                : ecart < 0
                  ? t(`Vente corrigée ✓ — ${fmtN(-ecart)} XAF à rembourser au client`, `Sale corrected ✓ — ${fmtN(-ecart)} XAF to refund the customer`)
                  : t(`Vente corrigée ✓ — ${fmtN(ecart)} XAF à encaisser`, `Sale corrected ✓ — ${fmtN(ecart)} XAF to collect`),
              'success',
            );
          }}
        />
      )}

      {deleteTarget && (
        <div onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fs-ink-900)', marginBottom: 6 }}>{t('Supprimer cette vente ?', 'Delete this sale?')}</div>
            <p style={{ fontSize: 13, color: 'var(--fs-ink-700)', lineHeight: 1.6, marginBottom: 18 }}>
              {t('Vente', 'Sale')} <strong>#{deleteTarget._id.slice(-6).toUpperCase()}</strong> {t('de', 'of')} <strong>{fmtN(deleteTarget.total)} XAF</strong>.<br/>
              {t('Le', 'The')} <strong>{t('stock sera restauré', 'stock will be restored')}</strong> {t('et la vente retirée de la comptabilité. Action irréversible, tracée dans le journal d\'audit.', 'and the sale removed from accounting. This action is irreversible and logged in the audit trail.')}
            </p>
            {/* Garde-fou : une suppression de vente doit être justifiée, comme une correction. */}
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', display: 'block', marginBottom: 14 }}>
              {t('Motif de la suppression (obligatoire)', 'Reason for deletion (required)')}
              <input value={motifSuppr} onChange={e => setMotifSuppr(e.target.value)} disabled={deleting}
                placeholder={t('Ex. : ticket saisi deux fois', 'E.g. receipt entered twice')}
                style={{ width: '100%', marginTop: 3, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--fs-font-sans)', color: 'var(--fs-ink-900)' }}/>
              {motifSuppr.length > 0 && motifSuppr.trim().length < 5 && (
                <span style={{ fontSize: 11, color: 'var(--fs-danger-700)' }}>{t('5 caractères minimum.', 'At least 5 characters.')}</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setDeleteTarget(null); setMotifSuppr(''); }}
                style={{ flex: 1, padding: '11px', border: '1.5px solid var(--fs-line-2)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-sans)' }}>
                {t('Annuler', 'Cancel')}
              </button>
              <button onClick={handleDeleteSale} disabled={deleting || motifSuppr.trim().length < 5}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: (deleting || motifSuppr.trim().length < 5) ? 'not-allowed' : 'pointer', background: motifSuppr.trim().length < 5 ? 'var(--fs-line-2)' : '#dc2626', color: '#fff', opacity: deleting ? 0.7 : 1, fontFamily: 'var(--fs-font-sans)' }}>
                {deleting ? t('Suppression…', 'Deleting…') : t('Oui, supprimer', 'Yes, delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 12, flexWrap: 'wrap' }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>{t('Pilotage', 'Management')}</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>{t('Journal des ventes', 'Sales journal')}</h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Live indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fs-ink-400)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }} />
                {relTime(lastRefresh.toISOString())}
              </div>

              {/* Filtres période */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => { setPeriod(p.key); setPage(0); }} style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: period === p.key ? 'var(--fs-wine-700)' : 'var(--fs-ivory)',
                    color:      period === p.key ? '#fff'               : 'var(--fs-ink-500)',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Plage de dates personnalisée */}
              {period === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ padding: '6px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 11 }} />
                  <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ padding: '6px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 11 }} />
                </div>
              )}

              {/* Filtre caissière — dropdown */}
              <select value={cashierFilter} onChange={e => { setCashierFilter(e.target.value); setPage(0); }}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff', color: cashierFilter ? 'var(--fs-wine-700)' : 'var(--fs-ink-500)', minWidth: 170 }}>
                <option value="">{t('👤 Toutes les caissières', '👤 All cashiers')}</option>
                {allCashiers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Export CSV */}
              <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}>
                <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /> CSV
              </button>

              {/* Refresh manuel */}
              <button onClick={() => load()} title={t('Rafraîchir', 'Refresh')}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center' }}>
                <I d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </button>
            </div>
          </div>
        </div>

        {/* Barre stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: isNarrow ? '10px 16px' : '10px 28px', background: 'var(--fs-wine-50)', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('Tickets', 'Receipts')} </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{filtered.length}</span>
            {pages > 1 && (
              <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 500, marginLeft: 6 }}>
                (page {safePage + 1}/{pages})
              </span>
            )}
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('Articles', 'Items')} </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{fmtN(nbArt)}</span>
          </div>
          <div>
            <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('CA total', 'Total revenue')} </span>
            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(totalCA)} XAF</span>
          </div>
          {/* Breakdown par mode paiement */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 8 }}>
            {Object.entries(byPm).sort((a, b) => b[1] - a[1]).map(([pm, amt]) => {
              const cfg = PM_COLORS[pm] ?? { bg: '#f5f5f5', color: '#555' };
              return (
                <span key={pm} style={{ display: 'flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>
                  <I d={PM_ICONS[pm] ?? PM_ICONS.cash} size={11} />
                  {PM_LABELS[pm] ?? pm} · {fmtN(amt)} XAF
                </span>
              );
            })}
          </div>

          {/* Stats par caissière */}
          {cashierList.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
              {cashierList.map(([name, st]) => (
                <button key={name}
                  onClick={() => { setCashierFilter(cashierFilter === name ? '' : name); setPage(0); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: cashierFilter === name ? 'var(--fs-wine-700)' : '#fff',
                    color:      cashierFilter === name ? '#fff'               : 'var(--fs-ink-700)',
                    border: '1.5px solid var(--fs-line-2)', borderRadius: 12,
                    padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>
                  👤 {name} · {st.nbVentes}{t('v', 's')} · {fmtN(st.ca)} XAF
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '0 16px 28px' : '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fs-ink-300)', fontSize: 14 }}>{t('Chargement…', 'Loading…')}</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto', marginTop: 16 }}>
              <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 760 : undefined }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    <th style={TH}/>
                    {JOURNAL_COLS.map(col => (
                      <th key={col.key} onClick={() => toggleSort(col.key)}
                        style={{ ...TH, textAlign: col.align, cursor: 'pointer', userSelect: 'none', color: sort.key === col.key ? 'var(--fs-wine-700)' : undefined }}>
                        {col.label}
                        <span style={{ marginLeft: 4, opacity: sort.key === col.key ? 1 : 0.25 }}>
                          {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
                        </span>
                      </th>
                    ))}
                    <th style={TH}/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                        {sales.length === 0
                          ? t('Aucune vente enregistrée sur cette période.', 'No sales recorded for this period.')
                          : t('Aucune vente correspond à la recherche.', 'No sales match the search.')}
                      </td>
                    </tr>
                  ) : paginated.map((s, i) => {
                    // Vente synchronisée hors-ligne : afficher la date réelle de la vente
                    const { date, heure } = fmtDatetime(s.dateVente ?? s.createdAt);
                    const isExp  = expanded.has(s._id);
                    const nbArtS = s.items.reduce((n, it) => n + it.quantity, 0);
                    const pmCfg  = PM_COLORS[s.paymentMethod] ?? { bg: '#f5f5f5', color: '#555' };
                    const artSummary = s.items.length === 1
                      ? `${s.items[0].quantity}× ${s.items[0].name}`
                      : t(`${nbArtS} article${nbArtS > 1 ? 's' : ''} (${s.items.length} réf.)`, `${nbArtS} item${nbArtS > 1 ? 's' : ''} (${s.items.length} ref.)`);

                    return (
                      <React.Fragment key={s._id}>
                        <tr
                          onClick={() => toggleExpand(s._id)}
                          style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: isExp ? 'none' : '1px solid var(--fs-line)', cursor: 'pointer' }}
                        >
                          {/* Chevron */}
                          <td style={{ padding: '10px 8px 10px 14px', color: 'var(--fs-ink-300)', width: 24 }}>
                            <I d={isExp ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} size={12} />
                          </td>
                          {/* Ticket # */}
                          <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: 'var(--fs-wine-700)', whiteSpace: 'nowrap' }}>
                            #{s._id.slice(-6).toUpperCase()}
                            {(s.modifications?.length ?? 0) > 0 && (
                              <span title={t('Vente corrigée — détail dans le ticket', 'Sale corrected — details in the receipt')}
                                style={{ marginLeft: 5, background: '#FEF3C7', color: '#92400E', borderRadius: 5, padding: '1px 5px', fontSize: 9, fontWeight: 700, fontFamily: 'var(--fs-font-sans)', letterSpacing: '0.04em' }}>
                                {t('CORRIGÉE', 'CORRECTED')}
                              </span>
                            )}
                          </td>
                          {/* Date heure (réelle si synchro hors-ligne) */}
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{date}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{heure}</div>
                            {s.syncOffline && (
                              <div title={t(`Vente faite hors connexion, synchronisée le ${fmtDatetime(s.createdAt).date} à ${fmtDatetime(s.createdAt).heure}`, `Sale made offline, synced on ${fmtDatetime(s.createdAt).date} at ${fmtDatetime(s.createdAt).heure}`)}
                                style={{ fontSize: 9, fontWeight: 700, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '1px 6px', marginTop: 3, display: 'inline-block' }}>
                                ⇅ {t('synchronisée', 'synced')}
                              </div>
                            )}
                          </td>
                          {/* Caissière */}
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            {s.cashierName ? (
                              <button
                                onClick={e => { e.stopPropagation(); setCashierFilter(cashierFilter === s.cashierName ? '' : (s.cashierName ?? '')); setPage(0); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: cashierFilter === s.cashierName ? 'var(--fs-wine-50)' : 'transparent', border: 'none', borderRadius: 6, padding: '2px 6px', cursor: 'pointer' }}>
                                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                  {(s.cashierName ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                                </span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-700)' }}>{s.cashierName}</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--fs-ink-300)' }}>—</span>
                            )}
                          </td>
                          {/* Articles */}
                          <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-600)', maxWidth: 260 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artSummary}</span>
                          </td>
                          {/* Mode paiement */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: pmCfg.bg, color: pmCfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                              <I d={PM_ICONS[s.paymentMethod] ?? PM_ICONS.cash} size={11} />
                              {PM_LABELS[s.paymentMethod] ?? s.paymentMethod}
                            </span>
                          </td>
                          {/* Montant payé */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)', whiteSpace: 'nowrap' }}>
                            {fmtN(s.amountPaid)} XAF
                          </td>
                          {/* Total */}
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)', whiteSpace: 'nowrap' }}>
                            {fmtN(s.total)} XAF
                          </td>
                          {/* Réimprimer + Corriger + Supprimer */}
                          <td style={{ padding: '10px 12px', textAlign: 'center', width: 108, whiteSpace: 'nowrap' }}>
                            <button onClick={e => { e.stopPropagation(); imprimerTicket(s); }} title={t('Réimprimer ce ticket', 'Reprint this receipt')}
                              style={{ background: '#fff', border: '1px solid var(--fs-line-2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>
                              <I d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setEditTarget(s); }} title={t('Corriger cette vente (client revenu avec le ticket)', 'Correct this sale (customer returned with the receipt)')}
                              style={{ background: 'var(--fs-wine-50)', border: '1px solid var(--fs-line-2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--fs-wine-700)', display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>
                              <I d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" size={13}/>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(s); }} title={t('Supprimer cette vente', 'Delete this sale')}
                              style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex', alignItems: 'center' }}>
                              <I d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" size={13}/>
                            </button>
                          </td>
                        </tr>
                        {isExp && <TicketDetail sale={s} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 16, padding: '0 2px' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                style={{ padding: '8px 16px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: safePage === 0 ? 'not-allowed' : 'pointer', opacity: safePage === 0 ? 0.4 : 1, color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <I d="M15 18l-6-6 6-6" size={12} /> {t('Précédent', 'Previous')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>
                  Page <strong>{safePage + 1}</strong> {t('sur', 'of')} <strong>{pages}</strong>
                </span>
                <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>
                  ({filtered.length} {t('ticket', 'receipt')}{filtered.length > 1 ? 's' : ''} · {fmtN(totalCA)} XAF)
                </span>
              </div>
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={safePage >= pages - 1}
                style={{ padding: '8px 16px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: safePage >= pages - 1 ? 'not-allowed' : 'pointer', opacity: safePage >= pages - 1 ? 0.4 : 1, color: 'var(--fs-ink-600)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('Suivant', 'Next')} <I d="M9 18l6-6-6-6" size={12} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--fs-ink-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--fs-ivory)',
  zIndex: 1,
};
