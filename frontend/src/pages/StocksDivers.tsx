import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import NouveauProduitModal from '../components/NouveauProduitModal';
import { getDiversSales, DiversSaleRow } from '../api/sales';
import { getAllProducts, Product } from '../api/products';
import { useIsMobile } from '../hooks/useIsMobile';

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em',
  borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: 'var(--fs-ivory)', zIndex: 1,
};

interface Groupe {
  name: string;
  dernierPrix: number;
  totalQte: number;
  totalMontant: number;
  occurrences: number;
  dernierDate: string;
  caissieres: string;
}

export default function StocksDivers() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
  const [rows, setRows]       = useState<DiversSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [prefill, setPrefill] = useState<{ name?: string; price?: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getDiversSales()); }
    catch { addToast('Erreur chargement des articles divers', 'error'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

  // Regroupe par désignation (insensible à la casse) pour faciliter la régularisation.
  const groupes = useMemo<Groupe[]>(() => {
    const map = new Map<string, Groupe>();
    for (const r of rows) {
      const key = r.name.trim().toLowerCase();
      const g = map.get(key);
      if (g) {
        g.totalQte     += r.quantity;
        g.totalMontant += r.total;
        g.occurrences  += 1;
        if (new Date(r.createdAt) > new Date(g.dernierDate)) {
          g.dernierDate = r.createdAt;
          g.dernierPrix = r.unitPrice;
        }
        if (r.cashierName && !g.caissieres.includes(r.cashierName)) {
          g.caissieres = g.caissieres ? `${g.caissieres}, ${r.cashierName}` : r.cashierName;
        }
      } else {
        map.set(key, {
          name: r.name, dernierPrix: r.unitPrice, totalQte: r.quantity,
          totalMontant: r.total, occurrences: 1, dernierDate: r.createdAt,
          caissieres: r.cashierName ?? '',
        });
      }
    }
    return [...map.values()].sort((a, b) => new Date(b.dernierDate).getTime() - new Date(a.dernierDate).getTime());
  }, [rows]);

  const totalMontant = groupes.reduce((s, g) => s + g.totalMontant, 0);

  const knownCategories = [...new Set(products.map(p => p.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <StocksSidebar alertCount={0}/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      {prefill && (
        <NouveauProduitModal
          prefill={prefill}
          knownCategories={knownCategories}
          existingProducts={products}
          onClose={() => setPrefill(null)}
          onCreated={() => {
            setPrefill(null);
            addToast('Produit créé ✓ — pensez à ajuster son stock', 'success');
            getAllProducts().then(setProducts).catch(() => {});
          }}
        />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0, paddingLeft: isMobile ? 60 : undefined }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Articles divers</h1>
        </div>

        {/* Info + stats */}
        <div style={{ padding: isNarrow ? '14px 16px 0' : '14px 28px 0', flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid rgba(122,29,46,0.15)', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: 'var(--fs-wine-800)', marginBottom: 14 }}>
            Articles vendus en caisse <strong>sans être enregistrés</strong> dans le système. Crée le produit correspondant, puis ajuste son stock pour régulariser.
          </div>
          <div style={{ display: isNarrow ? 'grid' : 'flex', gridTemplateColumns: isNarrow ? '1fr 1fr' : undefined, gap: isNarrow ? 10 : 14, flexWrap: 'wrap' }}>
            {[
              { label: 'Désignations à régulariser', val: fmtN(groupes.length), color: 'var(--fs-wine-700)' },
              { label: 'Total vendu (divers)',       val: `${fmtN(totalMontant)} XAF`, color: 'var(--fs-ink-800)' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 18px', minWidth: 140 }}>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', overflowX: 'auto', padding: isNarrow ? '14px 12px 16px' : '14px 28px 28px', minHeight: isNarrow ? undefined : 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : groupes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Aucun article divers à régulariser</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto' }}>
              <table className="fs-grid" style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {['Désignation', 'Dernier prix', 'Qté vendue', 'Total', 'Ventes', 'Dernière vente', 'Caissière(s)', ''].map(h => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupes.map((g, i) => (
                    <tr key={g.name + i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--fs-ink-900)' }}>{g.name}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{fmtN(g.dernierPrix)} XAF</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-ink-800)' }}>{g.totalQte}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>{fmtN(g.totalMontant)} XAF</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--fs-ink-500)' }}>{g.occurrences}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fs-ink-500)', whiteSpace: 'nowrap' }}>{fmtDate(g.dernierDate)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--fs-ink-600)' }}>{g.caissieres || '—'}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setPrefill({ name: g.name, price: String(Math.round(g.dernierPrix)) })}
                          style={{ padding: '6px 12px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}>
                          Créer le produit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
