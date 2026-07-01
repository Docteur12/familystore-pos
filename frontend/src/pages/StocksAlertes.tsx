import React, { useCallback, useEffect, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import { getAllProducts, Product } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';
import { qtyUnitLabel } from '../utils/units';
import { getBrandColor } from '../utils/text';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Helpers ────────────────────────────────────────────────────────────────────

type AlertStatus = 'rupture' | 'critique' | 'alerte';
function getStatus(p: Product): AlertStatus {
  if (p.stock === 0) return 'rupture';
  if (p.stock <= Math.ceil(p.alertThreshold * 0.4)) return 'critique';
  return 'alerte';
}
const STATUS_CFG: Record<AlertStatus, { label: string; bg: string; color: string }> = {
  rupture:  { label: 'Rupture',  bg: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)' },
  critique: { label: 'Critique', bg: '#FEF0E0', color: '#8B5A14' },
  alerte:   { label: 'Alerte',   bg: '#F7ECD4', color: '#8B5A14' },
};

function expiryOf(p: Product): Date | null {
  if (!p.expiryDate) return null;
  return new Date(p.expiryDate);
}
function daysUntil(d: Date) {
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

function I({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}
const D = {
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  mail:    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  zap:     'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
};

type TabKey = 'reappro' | 'peremption' | 'suggestions';
type ExpiryFilter = '30' | '90' | '180';

// ── Main component ─────────────────────────────────────────────────────────────

export default function StocksAlertes() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabKey>('reappro');
  const [statusFilter, setStatusFilter] = useState<'all' | AlertStatus>('all');
  const [expiryFilter, setExpFilter] = useState<ExpiryFilter>('180');

  const load = useCallback(async () => {
    setLoading(true);
    try { setProducts(await getAllProducts()); }
    catch { addToast('Erreur chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tab 1: low stock
  const lowProducts = products
    .filter(p => p.stock <= p.alertThreshold)
    .sort((a, b) => (a.stock / a.alertThreshold) - (b.stock / b.alertThreshold));

  // Tab 2: expiry (only products with a real expiryDate)
  const maxDays = parseInt(expiryFilter);
  const expiryProducts = products
    .map(p => { const exp = expiryOf(p); return exp ? { p, days: daysUntil(exp) } : null; })
    .filter((x): x is { p: Product; days: number } => x !== null && x.days <= maxDays)
    .sort((a, b) => a.days - b.days);

  // Tab 3: suggestions (products needing reorder)
  const suggestions = products
    .filter(p => p.stock <= p.alertThreshold * 1.5)
    .map(p => ({
      p,
      recommended: Math.max(p.alertThreshold * 2 - p.stock, 0),
      urgency: p.stock === 0 ? 'Urgent' : p.stock <= p.alertThreshold * 0.4 ? 'Critique' : 'Normal',
    }))
    .sort((a, b) => b.recommended - a.recommended);

  const alertCount = lowProducts.length;
  // Liste filtrée par la carte cliquée (Ruptures / Critiques / Alertes / Total)
  const displayedLow = statusFilter === 'all' ? lowProducts : lowProducts.filter(p => getStatus(p) === statusFilter);

  const handleEmailRecap = () => {
    const lines = lowProducts.map(p => `• ${p.name} : stock ${p.stock}/${p.alertThreshold}`).join('\n');
    const mailto = `mailto:?subject=Recap%20alertes%20stock%20—%20Family%20Store&body=${encodeURIComponent(`Résumé alertes stock — ${new Date().toLocaleDateString('fr-FR')}\n\n${lines}`)}`;
    window.open(mailto);
  };

  // Données d'export selon l'onglet actif.
  const exportData = (): { title: string; headers: string[]; rows: (string | number)[][] } => {
    if (tab === 'peremption') {
      return {
        title: 'Péremption proche',
        headers: ['Produit', 'Catégorie', 'Jours restants', 'Date péremption'],
        rows: expiryProducts.map(({ p, days }) => [p.name, p.category ?? '', days, expiryOf(p)?.toLocaleDateString('fr-FR') ?? '']),
      };
    }
    if (tab === 'suggestions') {
      return {
        title: 'Suggestions de réapprovisionnement',
        headers: ['Produit', 'Stock', 'Qté conseillée', 'Urgence'],
        rows: suggestions.map(({ p, recommended, urgency }) => [p.name, p.stock, recommended, urgency]),
      };
    }
    return {
      title: 'Réapprovisionnement',
      headers: ['Produit', 'Catégorie', 'Stock actuel', 'Seuil', 'Statut'],
      rows: displayedLow.map(p => [p.name, p.category ?? '', p.stock, p.alertThreshold, STATUS_CFG[getStatus(p)].label]),
    };
  };

  const handleExportPdf = async () => {
    const { title, headers, rows } = exportData();
    if (rows.length === 0) { addToast('Rien à exporter', 'error'); return; }
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const hex = getBrandColor();
      const rgb: [number, number, number] = /^#[0-9A-Fa-f]{6}$/.test(hex)
        ? [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
        : [255, 0, 0];
      const trunc = (s: string, max = 46) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
      const margin = 14;
      const valN = headers.length - 1;
      const right0 = 108, rightN = 196;
      const step = valN > 1 ? (rightN - right0) / (valN - 1) : 0;
      const valX = (i: number) => (valN === 1 ? rightN : right0 + step * i);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.rect(0, 0, 210, 24, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(`Family Store — ${title}`, margin, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(`${rows.length} produit(s)  ·  ${new Date().toLocaleDateString('fr-FR')}`, margin, 19);
      let y = 34;
      const head = () => {
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(headers[0], margin, y);
        for (let i = 0; i < valN; i++) doc.text(headers[i + 1], valX(i), y, { align: 'right' });
        y += 2; doc.setDrawColor(180); doc.line(margin, y, rightN, y); y += 5;
      };
      head();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      for (const r of rows) {
        if (y > 285) { doc.addPage(); y = 18; head(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
        doc.setTextColor(20, 20, 20);
        doc.text(trunc(String(r[0])), margin, y);
        for (let i = 0; i < valN; i++) doc.text(String(r[i + 1]), valX(i), y, { align: 'right' });
        y += 5.5;
      }
      doc.save(`alertes_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      addToast('Erreur export PDF', 'error');
    }
  };

  const handleExportExcel = () => {
    const { headers, rows } = exportData();
    if (rows.length === 0) { addToast('Rien à exporter', 'error'); return; }
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rowsHtml = rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `alertes_${tab}_${new Date().toISOString().slice(0, 10)}.xls`;
    a.click(); URL.revokeObjectURL(url);
    addToast('Export Excel prêt', 'success');
  };

  const tabs: { id: TabKey; label: string; count: number; color: string }[] = [
    { id: 'reappro',     label: 'Réapprovisionnement', count: lowProducts.length,     color: '#D97706' },
    { id: 'peremption',  label: 'Péremption proche',   count: expiryProducts.length,  color: '#DC2626' },
    { id: 'suggestions', label: 'Suggestions auto',    count: suggestions.length,     color: 'var(--fs-wine-700)' },
  ];

  const ruptures  = lowProducts.filter(p => p.stock === 0).length;
  const critiques = lowProducts.filter(p => p.stock > 0 && p.stock <= Math.ceil(p.alertThreshold * 0.4)).length;
  const alertes   = lowProducts.length - ruptures - critiques;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar alertCount={alertCount}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 44 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Alertes & Seuils</h1>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button onClick={handleEmailRecap}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.mail} size={13}/> Récap email
              </button>
              <button onClick={handleExportPdf} title="Exporter en PDF (onglet actif)"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-wine-700)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                PDF
              </button>
              <button onClick={handleExportExcel} title="Exporter en Excel (onglet actif)"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-wine-700)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                Excel
              </button>
              <button onClick={load}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.refresh} size={13}/> Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: isNarrow ? 'grid' : 'flex', gridTemplateColumns: isNarrow ? '1fr 1fr' : undefined, gap: isNarrow ? 10 : 14, padding: isNarrow ? '14px 16px' : '16px 24px', flexShrink: 0 }}>
          {([
            { label: 'Ruptures',  count: ruptures,  bg: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)', filter: 'rupture' },
            { label: 'Critiques', count: critiques, bg: '#FEF0E0', color: '#8B5A14', filter: 'critique' },
            { label: 'Alertes',   count: alertes,   bg: '#F7ECD4', color: '#8B5A14', filter: 'alerte' },
            { label: 'Total',     count: alertCount, bg: 'var(--fs-wine-50)', color: 'var(--fs-wine-800)', filter: 'all' },
          ] as { label: string; count: number; bg: string; color: string; filter: 'all' | AlertStatus }[]).map(s => {
            const active = tab === 'reappro' && statusFilter === s.filter;
            return (
            <div key={s.label} onClick={() => { setTab('reappro'); setStatusFilter(s.filter); }}
              title={`Voir : ${s.label}`}
              style={{ flex: 1, background: '#fff', border: active ? '2px solid var(--fs-wine-700)' : '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)', cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.count}</span>
                {s.count > 0 && <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{s.label}</span>}
              </div>
            </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', padding: isNarrow ? '0 16px 12px' : '0 24px 12px', gap: 6, flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: tab === t.id ? 'none' : '1.5px solid var(--fs-line-2)',
              background: tab === t.id ? t.color : '#fff',
              color: tab === t.id ? '#fff' : 'var(--fs-ink-500)',
              fontFamily: 'var(--fs-font-sans)',
            }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', padding: '1px 6px', borderRadius: 10, color: tab === t.id ? '#fff' : 'var(--fs-ink-400)' }}>
                {t.count}
              </span>
            </button>
          ))}
          {tab === 'peremption' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {(['30', '90', '180'] as ExpiryFilter[]).map(f => (
                <button key={f} onClick={() => setExpFilter(f)} style={{
                  padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: expiryFilter === f ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: expiryFilter === f ? '#DC2626' : '#fff',
                  color: expiryFilter === f ? '#fff' : 'var(--fs-ink-400)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>≤ {f}j</button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', overflowX: 'auto', padding: isNarrow ? '0 12px 16px' : '0 24px 24px', minHeight: isNarrow ? undefined : 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : tab === 'reappro' ? (
            displayedLow.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{statusFilter === 'all' ? 'Tous les stocks sont suffisants' : `Aucun produit « ${STATUS_CFG[statusFilter].label} »`}</div>
                {statusFilter !== 'all' && <button onClick={() => setStatusFilter('all')} style={{ marginTop: 12, padding: '6px 14px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-500)' }}>Voir tout</button>}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 720 : 640, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Produit', 'Catégorie', 'Stock actuel', 'Seuil (auto 10%)', 'Statut'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 && i <= 3 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedLow.map((p, idx) => {
                    const status = getStatus(p);
                    const st = STATUS_CFG[status];
                    return (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                          {p.localName && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{p.localName}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : 'var(--fs-warning-700)' }}>
                          {p.stock}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{p.alertThreshold}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>= 10% de {p.initialStock ?? p.alertThreshold * 10}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )
          ) : tab === 'peremption' ? (
            expiryProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune péremption dans les {maxDays} jours</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 720 : 640, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Produit', 'Catégorie', 'Stock', 'Date péremption', 'Délai', 'Urgence'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expiryProducts.map(({ p, days }, idx) => {
                    const exp = expiryOf(p)!;
                    const isExpired = days < 0;
                    const isSoon = days >= 0 && days <= 30;
                    const bg   = isExpired ? 'var(--fs-wine-100)' : isSoon ? '#FEF0E0' : '#F7ECD4';
                    const color = isExpired ? 'var(--fs-wine-700)' : '#8B5A14';
                    return (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                          {p.localName && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{p.localName}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{p.stock}{qtyUnitLabel(p.unit) && ` ${qtyUnitLabel(p.unit)}`}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>
                          {exp.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color }}>
                          {isExpired ? 'Expiré' : `${days} j`}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                            {isExpired ? 'Expiré' : isSoon ? 'Urgent' : 'À surveiller'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )
          ) : (
            // Suggestions tab
            suggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune suggestion de commande</div>
              </div>
            ) : (
              <>
                <div style={{ background: '#fff', border: '1px solid rgba(122,29,46,0.15)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 12, color: 'var(--fs-wine-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <I d={D.zap} size={14}/> Ces suggestions sont calculées automatiquement : stock conseillé = 2× seuil d'alerte.
                </div>
                <div style={{ overflowX: 'auto' }}>
                <table className="fs-grid" style={{ width: '100%', minWidth: isNarrow ? 720 : 640, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produit', 'Catégorie', 'Stock actuel', 'Seuil', 'Qté recommandée', 'Urgence'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'center' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map(({ p, recommended, urgency }, idx) => (
                      <tr key={p._id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
                          {p.localName && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{p.localName}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--fs-ink-500)' }}>{p.category ?? '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: p.stock === 0 ? 'var(--fs-danger-700)' : 'var(--fs-warning-700)' }}>{p.stock}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{p.alertThreshold}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>+{recommended}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                            background: urgency === 'Urgent' ? 'var(--fs-wine-100)' : urgency === 'Critique' ? '#FEF0E0' : '#F7ECD4',
                            color: urgency === 'Urgent' ? 'var(--fs-wine-700)' : '#8B5A14',
                          }}>{urgency}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )
          )}
        </div>
      </main>
    </div>
  );
}
