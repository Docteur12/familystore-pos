import React, { useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product, updateProduct } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';
import { qtyUnitLabel } from '../utils/units';
import { getBrandColor } from '../utils/text';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Types ──────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Beauté', 'Hygiène', 'Parfumerie', 'Épicerie', 'Boissons', 'Alimentation', 'Bien-être', 'Maison'];

interface InventaireRow {
  product: Product;
  counted: string;
  dirty: boolean;
  justification: string;
}

interface SeanceRecord {
  id: string;
  date: string;
  type: 'total' | 'partiel';
  categorie: string;
  rows: {
    productId: string;
    productName: string;
    stockTheorique: number;
    stockCompte: number;
    ecart: number;
    justification: string;
    unit: string;
  }[];
  createdAt: string;
}

const LS_KEY = 'fs_inventaires';
function loadHistory(): SeanceRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function saveHistory(list: SeanceRecord[]) { localStorage.setItem(LS_KEY, JSON.stringify(list)); }

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
  check:   'M20 6L9 17l-5-5',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  print:   'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  history: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
};

type ViewMode = 'seance' | 'history';

export default function StocksInventaire() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
  const [view, setView]         = useState<ViewMode>('seance');
  const [rows, setRows]         = useState<InventaireRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [history, setHistory]   = useState<SeanceRecord[]>(loadHistory);

  // Séance config
  const [type, setType]         = useState<'total' | 'partiel'>('total');
  const [categorie, setCat]     = useState('');
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const products = await getAllProducts();
      setRows(products.map(p => ({ product: p, counted: String(p.stock), dirty: false, justification: '' })));
    } catch { addToast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setCounted = (id: string, val: string) => {
    setRows(prev => prev.map(r =>
      r.product._id === id
        ? { ...r, counted: val, dirty: val !== String(r.product.stock) }
        : r
    ));
  };

  const setJustif = (id: string, val: string) => {
    setRows(prev => prev.map(r => r.product._id === id ? { ...r, justification: val } : r));
  };

  const dirtyRows = rows.filter(r => r.dirty && r.counted !== '' && !isNaN(parseInt(r.counted)));

  const displayed = rows.filter(r => {
    const matchSearch = !search || r.product.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = type === 'total' || !categorie || r.product.category?.toLowerCase() === categorie.toLowerCase();
    return matchSearch && matchCat;
  });

  // Export PDF de l'inventaire (côté client, en-tête à la couleur de la boutique).
  const exportInventairePdf = async () => {
    if (displayed.length === 0) { addToast('Aucun produit à exporter', 'error'); return; }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const hex = getBrandColor();
      const rgb: [number, number, number] = /^#[0-9A-Fa-f]{6}$/.test(hex)
        ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
        : [139, 26, 43];
      const trunc = (s: string, max = 46) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
      const margin = 14;
      const cX = { nom: margin, cat: 96, unit: 130, theo: 158, cmp: 178, ecart: 196 };

      // En-tête couleur boutique
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(0, 0, 210, 24, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('Family Store — Inventaire', margin, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`${type === 'total' ? 'Inventaire total' : `Partiel · ${categorie || 'toutes catégories'}`}  ·  ${displayed.length} produit(s)  ·  ${date}`, margin, 19);

      let y = 34;
      const header = () => {
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('Produit', cX.nom, y);
        doc.text('Catégorie', cX.cat, y);
        doc.text('Unité', cX.unit, y);
        doc.text('Théo.', cX.theo, y, { align: 'right' });
        doc.text('Compté', cX.cmp, y, { align: 'right' });
        doc.text('Écart', cX.ecart, y, { align: 'right' });
        y += 2; doc.setDrawColor(180); doc.line(margin, y, 196, y); y += 5;
      };
      header();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      for (const r of displayed) {
        if (y > 285) { doc.addPage(); y = 18; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
        const theo = r.product.stock;
        const cmp = r.counted === '' ? null : parseInt(r.counted);
        const ecart = cmp === null ? null : cmp - theo;
        doc.setTextColor(20, 20, 20);
        doc.text(trunc(r.product.name), cX.nom, y);
        doc.text(trunc(r.product.category ?? '—', 18), cX.cat, y);
        doc.text(String(r.product.unit ?? ''), cX.unit, y);
        doc.text(String(theo), cX.theo, y, { align: 'right' });
        doc.text(cmp === null ? '—' : String(cmp), cX.cmp, y, { align: 'right' });
        if (ecart !== null && ecart !== 0) doc.setTextColor(ecart > 0 ? 21 : 194, ecart > 0 ? 128 : 62, ecart > 0 ? 61 : 36);
        doc.text(ecart === null ? '—' : (ecart > 0 ? `+${ecart}` : String(ecart)), cX.ecart, y, { align: 'right' });
        y += 5.5;
      }
      doc.save(`inventaire-${date || new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      addToast('Erreur export PDF', 'error');
    }
  };

  // Export Excel (.xls) — tableau HTML ouvert nativement par Excel.
  const exportInventaireExcel = () => {
    if (displayed.length === 0) { addToast('Aucun produit à exporter', 'error'); return; }
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const headers = ['Produit', 'Catégorie', 'Unité', 'Stock théorique', 'Compté', 'Écart'];
    const rowsHtml = displayed.map(r => {
      const theo = r.product.stock;
      const cmp = r.counted === '' ? null : parseInt(r.counted);
      const ecart = cmp === null ? '' : cmp - theo;
      const cells = [r.product.name, r.product.category ?? '', r.product.unit ?? '', theo, cmp === null ? '' : cmp, ecart];
      return '<tr>' + cells.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
    }).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `inventaire-${date || new Date().toISOString().slice(0, 10)}.xls`;
    a.click(); URL.revokeObjectURL(url);
    addToast('Export Excel prêt', 'success');
  };

  const handleValidate = async () => {
    const toUpdate = dirtyRows.filter(r => {
      const matchCat = type === 'total' || !categorie || r.product.category?.toLowerCase() === categorie.toLowerCase();
      return matchCat;
    });
    if (toUpdate.length === 0) return;
    setSaving(true);
    let ok = 0; let fail = 0;
    for (const r of toUpdate) {
      try {
        await updateProduct(r.product._id, { stock: parseInt(r.counted) });
        ok++;
      } catch { fail++; }
    }
    setSaving(false);

    // Save to history
    const seance: SeanceRecord = {
      id: Date.now().toString(),
      date,
      type,
      categorie: type === 'partiel' ? categorie : '',
      rows: toUpdate.map(r => ({
        productId: r.product._id,
        productName: r.product.name,
        stockTheorique: r.product.stock,
        stockCompte: parseInt(r.counted),
        ecart: parseInt(r.counted) - r.product.stock,
        justification: r.justification,
        unit: r.product.unit,
      })),
      createdAt: new Date().toISOString(),
    };
    const updatedHistory = [seance, ...history];
    setHistory(updatedHistory);
    saveHistory(updatedHistory);

    if (ok > 0) addToast(`${ok} produit(s) mis à jour`, 'success');
    if (fail > 0) addToast(`${fail} erreur(s)`, 'error');
    load();
  };

  const handlePrint = () => {
    const dirtyToShow = dirtyRows.filter(r => {
      const matchCat = type === 'total' || !categorie || r.product.category?.toLowerCase() === categorie.toLowerCase();
      return matchCat;
    });
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Inventaire — ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid #000; background: #f0f0f0; }
        td { padding: 8px 10px; font-size: 13px; border: 1px solid #999; }
        .diff-pos { color: green; font-weight: bold; }
        .diff-neg { color: red; font-weight: bold; }
        .diff-0   { color: #666; }
      </style></head>
      <body>
        <h2>Inventaire — ${type === 'partiel' ? 'Partiel · ' + categorie : 'Total'}</h2>
        <div class="sub">Date : ${date} · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
        <table>
          <thead><tr><th>Produit</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Justification</th></tr></thead>
          <tbody>
            ${dirtyToShow.map(r => {
              const ecart = parseInt(r.counted) - r.product.stock;
              return `<tr>
                <td>${r.product.name}</td>
                <td>${r.product.stock}${qtyUnitLabel(r.product.unit) ? ' ' + qtyUnitLabel(r.product.unit) : ''}</td>
                <td><b>${r.counted}${qtyUnitLabel(r.product.unit) ? ' ' + qtyUnitLabel(r.product.unit) : ''}</b></td>
                <td class="${ecart > 0 ? 'diff-pos' : ecart < 0 ? 'diff-neg' : 'diff-0'}">${ecart > 0 ? '+' : ''}${ecart}</td>
                <td>${r.justification || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <script>window.onload = () => window.print()<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const diffColor = (r: InventaireRow) => {
    if (!r.dirty) return 'var(--fs-ink-400)';
    const diff = parseInt(r.counted) - r.product.stock;
    return diff > 0 ? 'var(--fs-success-700)' : diff < 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)';
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 12 }}>
            <div style={{ paddingLeft: isMobile ? 44 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Inventaire</h1>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['seance', 'history'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: view === v ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: view === v ? 'var(--fs-wine-700)' : '#fff',
                  color: view === v ? '#fff' : 'var(--fs-ink-500)',
                  fontFamily: 'var(--fs-font-sans)', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <I d={v === 'seance' ? D.check : D.history} size={13}/>
                  {v === 'seance' ? 'Saisie' : `Historique (${history.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'seance' ? (
          <>
            {/* Séance config */}
            <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 24px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['total', 'partiel'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: type === t ? 'none' : '1.5px solid var(--fs-line-2)',
                    background: type === t ? 'var(--fs-wine-700)' : '#fff',
                    color: type === t ? '#fff' : 'var(--fs-ink-500)',
                    fontFamily: 'var(--fs-font-sans)',
                  }}>
                    {t === 'total' ? 'Inventaire total' : 'Inventaire partiel'}
                  </button>
                ))}
              </div>
              {type === 'partiel' && (
                <select value={categorie} onChange={e => setCat(e.target.value)}
                  style={{ padding: '7px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff' }}>
                  <option value="">— Toutes catégories —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Date :</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)' }}/>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-300)' }}><I d={D.search} size={13}/></span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                    style={{ paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)', width: 200 }}/>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                  <I d={D.refresh} size={14}/>
                </button>
                <button onClick={exportInventairePdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600 }}>
                  <I d={D.print} size={13}/> PDF
                </button>
                <button onClick={exportInventaireExcel} title="Exporter l'inventaire en Excel" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600 }}>
                  Excel
                </button>
                {dirtyRows.length > 0 && (
                  <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600 }}>
                    <I d={D.print} size={13}/> Écarts
                  </button>
                )}
                <button onClick={handleValidate} disabled={dirtyRows.length === 0 || saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', border: 'none', borderRadius: 8, background: dirtyRows.length > 0 ? 'var(--fs-wine-700)' : 'var(--fs-line)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: dirtyRows.length > 0 ? 'pointer' : 'default', opacity: saving ? 0.7 : 1, fontFamily: 'var(--fs-font-sans)' }}>
                  <I d={D.check} size={13}/>
                  {saving ? 'Enregistrement…' : `Valider${dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ''}`}
                </button>
              </div>
            </div>

            {/* Info banner */}
            <div style={{ padding: '8px 24px', background: 'var(--fs-info-100)', borderBottom: '1px solid var(--fs-line)', fontSize: 12, color: 'var(--fs-info-700)', flexShrink: 0 }}>
              Saisissez le stock compté. Les cases modifiées apparaissent en surbrillance — ajoutez une justification si nécessaire.
            </div>

            {/* Table */}
            <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '0 12px 16px' : '0 24px 24px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table className="fs-grid" style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produit', 'Catégorie', 'Unité', 'Théorique', 'Compté', 'Écart', 'Justification'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: i >= 3 && i <= 5 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((r, idx) => {
                      const diff = r.dirty && r.counted !== '' ? parseInt(r.counted) - r.product.stock : null;
                      return (
                        <tr key={r.product._id} style={{ background: r.dirty ? 'var(--fs-gold-50)' : idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)', transition: 'background 0.15s' }}>
                          <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{r.product.name}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{r.product.category ?? '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fs-ink-400)', textAlign: 'center' }}>{r.product.unit}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{r.product.stock}</td>
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <input type="number" min={0} value={r.counted}
                              onChange={e => setCounted(r.product._id, e.target.value)}
                              style={{ width: 90, padding: '6px 10px', textAlign: 'center', border: r.dirty ? '2px solid var(--fs-wine-700)' : '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', outline: 'none', background: r.dirty ? 'var(--fs-wine-50)' : '#fff', color: 'var(--fs-ink-900)' }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: diffColor(r) }}>
                            {diff === null ? '—' : diff > 0 ? `+${diff}` : diff === 0 ? '=' : diff}
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            {r.dirty && diff !== 0 && (
                              <input value={r.justification}
                                onChange={e => setJustif(r.product._id, e.target.value)}
                                placeholder="Motif de l'écart…"
                                style={{ width: '100%', padding: '5px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'var(--fs-font-sans)', minWidth: 160 }}/>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </>
        ) : (
          // History view
          <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '20px 12px' : '20px 24px' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Aucun inventaire enregistré</div>
            ) : history.map(s => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, marginBottom: 14, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ padding: '12px 18px', background: 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)' }}>{s.date}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: s.type === 'total' ? 'var(--fs-wine-50)' : '#E8F0E5', color: s.type === 'total' ? 'var(--fs-wine-800)' : 'var(--fs-success-700)' }}>
                      {s.type === 'total' ? 'Inventaire total' : `Partiel · ${s.categorie}`}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>{s.rows.length} produit(s)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                <table className="fs-grid" style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produit', 'Théorique', 'Compté', 'Écart', 'Justification'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={r.productId} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{r.productName}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{r.stockTheorique}{qtyUnitLabel(r.unit) && ` ${qtyUnitLabel(r.unit)}`}</td>
                        <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{r.stockCompte}{qtyUnitLabel(r.unit) && ` ${qtyUnitLabel(r.unit)}`}</td>
                        <td style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: r.ecart > 0 ? 'var(--fs-success-700)' : r.ecart < 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>
                          {r.ecart > 0 ? `+${r.ecart}` : r.ecart === 0 ? '=' : r.ecart}
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--fs-ink-500)', fontStyle: r.justification ? 'normal' : 'italic' }}>
                          {r.justification || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
