import React, { useEffect, useRef, useState } from 'react';
import StocksSidebar from '../components/StocksSidebar';
import AutocompleteInput from '../components/AutocompleteInput';
import { getAllProducts, Product } from '../api/products';
import ToastContainer, { useToast } from '../components/Toast';
import { getAllReceptions, ReceptionFull } from '../api/magazinier';
import { getFournisseurs } from '../api/fournisseurs';
import { getBonsLivraison, createBonLivraison, BonLivraisonRecord } from '../api/bons-livraison';
import { qtyUnitLabel } from '../utils/units';
import { useIsMobile } from '../hooks/useIsMobile';

const LS_RECEPTION_SEEN = 'receptions_last_seen';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BLLine {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  barcode: string;
  qteAttendue: string;
  qteRecue: string;
  datePeremption: string;
  etatEmballage: 'bon' | 'endommage' | '';
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
  plus:   'M12 5v14M5 12h14',
  trash:  'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  check:  'M20 6L9 17l-5-5',
  search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z',
  pkg:    'M12 2l9 4.5v11L12 22 3 17.5v-11L12 2zM12 22V11.5M3 6.5l9 5 9-5',
};

function newLine(): BLLine {
  return { id: Date.now().toString() + Math.random(), productId: '', productName: '', unit: 'unité', barcode: '', qteAttendue: '', qteRecue: '', datePeremption: '', etatEmballage: '' };
}

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

function drawCode39(canvas: HTMLCanvasElement, text: string, barW = 1.0, h = 26) {
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

// ── BLProductCell — sélecteur produit avec scan code-barres ───────────────────

function BLProductCell({ products, line, onChange, onScanned }: {
  products: Product[];
  line: BLLine;
  onChange: (patch: Partial<BLLine>) => void;
  onScanned?: (name: string) => void;
}) {
  const [scanMode, setScanMode] = useState(false);
  const scanRef   = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (line.barcode && canvasRef.current) drawCode39(canvasRef.current, line.barcode);
  }, [line.barcode]);

  const activateScan = () => {
    setScanMode(true);
    setTimeout(() => scanRef.current?.focus(), 30);
  };

  const handleBarcode = (raw: string) => {
    const code = raw.trim();
    const match = products.find(p => (p.barcode ?? '').trim() === code);
    if (match) {
      onChange({ barcode: code, productId: match._id, productName: match.name, unit: match.unit });
      setScanMode(false);
      onScanned?.(match.name); // garde-fou : confirme le produit reconnu
    } else {
      onChange({ barcode: raw });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Ligne scan */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {scanMode ? (
          <input
            ref={scanRef}
            type="text"
            inputMode="numeric"
            value={line.barcode}
            onChange={e => handleBarcode(e.target.value)}
            onBlur={() => { if (!line.barcode) setScanMode(false); }}
            placeholder="Pointez le scanner..."
            style={{ flex: 1, padding: '5px 8px', border: '1.5px solid var(--fs-wine-700)', borderRadius: 7,
              fontSize: 11, outline: 'none', fontFamily: 'var(--fs-font-mono)', boxSizing: 'border-box',
              animation: 'scanPulse 1.2s ease-in-out infinite' }}
          />
        ) : (
          <div style={{ flex: 1, fontSize: 10, fontFamily: 'var(--fs-font-mono)',
            color: line.barcode ? 'var(--fs-ink-600)' : 'var(--fs-ink-300)',
            background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)',
            borderRadius: 7, padding: '4px 8px', minHeight: 26 }}>
            {line.barcode || 'Aucun code-barres'}
          </div>
        )}
        <button type="button" onClick={activateScan}
          style={{ width: 28, height: 28, flexShrink: 0, border: `1.5px solid ${scanMode ? 'var(--fs-wine-700)' : 'var(--fs-line-2)'}`,
            borderRadius: 7, background: scanMode ? 'rgba(122,29,46,0.07)' : '#fff',
            cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Scanner le code-barres">
          📷
        </button>
      </div>

      {/* Preview code-barres */}
      {line.barcode && (
        <div style={{ borderRadius: 6, border: '1px solid var(--fs-line)', overflow: 'hidden', lineHeight: 0 }}>
          <canvas ref={canvasRef} style={{ display: 'block', height: 26, imageRendering: 'pixelated' }}/>
        </div>
      )}

      {/* Sélecteur produit par nom */}
      <ProductPicker
        products={products}
        value={line.productId ? { id: line.productId, name: line.productName, unit: line.unit } : null}
        onChange={p => onChange({ productId: p._id, productName: p.name, unit: p.unit })}
      />
      {line.barcode && !line.productId && (
        <div style={{ fontSize: 10, color: 'var(--fs-danger-700)', fontWeight: 600 }}>
          Produit non trouvé — chercher manuellement
        </div>
      )}
      <style>{`@keyframes scanPulse{0%,100%{box-shadow:0 0 0 3px rgba(122,29,46,0.10)}50%{box-shadow:0 0 0 5px rgba(122,29,46,0.22)}}`}</style>
    </div>
  );
}

// ── Product selector ───────────────────────────────────────────────────────────

function ProductPicker({ products, value, onChange }: {
  products: Product[];
  value: { id: string; name: string; unit: string } | null;
  onChange: (p: Product) => void;
}) {
  const [search, setSearch] = useState(value?.name ?? '');
  const [open, setOpen]     = useState(false);

  useEffect(() => { setSearch(value?.name ?? ''); }, [value]);

  const filtered = products.filter(p =>
    search.trim() && p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <input value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chercher produit…"
        style={{ width: '100%', padding: '6px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, boxShadow: 'var(--fs-shadow-md)', zIndex: 10, maxHeight: 160, overflowY: 'auto' }}>
          {filtered.slice(0, 8).map(p => (
            <button key={p._id} onMouseDown={() => { onChange(p); setOpen(false); }}
              style={{ width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--fs-line)', display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Stock : {p.stock}{qtyUnitLabel(p.unit) && ` ${qtyUnitLabel(p.unit)}`}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ViewMode = 'form' | 'history';
type HistoFilter = 'tous' | 'moi' | 'magazinier';

export default function StocksReceptions() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024); // mobile + tablette : agencement empilé du contenu
  const [products, setProducts] = useState<Product[]>([]);
  const [bls, setBls]           = useState<BonLivraisonRecord[]>([]);
  const [view, setView]         = useState<ViewMode>('form');
  const [loading, setLoading]   = useState(false);
  const [magRecs, setMagRecs]   = useState<ReceptionFull[]>([]);
  const [histoFilter, setHistoFilter] = useState<HistoFilter>('tous');
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // BL header
  const [numeroBL, setNumeroBL]   = useState('');
  const [fournisseur, setFourn]   = useState('');
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));

  // Lines
  const [lines, setLines] = useState<BLLine[]>([newLine()]);

  useEffect(() => { getAllProducts().then(setProducts).catch(() => {}); }, []);

  useEffect(() => {
    getFournisseurs().then(list => setSuppliers(list.map(f => f.name))).catch(() => {});
  }, []);

  useEffect(() => {
    getBonsLivraison().then(setBls).catch(() => {});
  }, []);

  // Charge les réceptions magazinier + marque comme vu
  useEffect(() => {
    getAllReceptions().then(recs => {
      setMagRecs(recs);
      localStorage.setItem(LS_RECEPTION_SEEN, Date.now().toString());
    }).catch(() => {});
  }, []);

  const setLine = (id: string, patch: Partial<BLLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleSubmit = async () => {
    const validLines = lines.filter(l => l.productId && parseInt(l.qteRecue) > 0);
    if (!fournisseur || validLines.length === 0) {
      addToast('Fournisseur et au moins une ligne avec quantité reçue sont requis', 'error');
      return;
    }
    setLoading(true);
    try {
      const bl = await createBonLivraison({
        numeroBL: numeroBL || undefined,
        fournisseur,
        date,
        lignes: validLines.map(l => ({
          productId:      l.productId,
          qteAttendue:    parseInt(l.qteAttendue) || 0,
          qteRecue:       parseInt(l.qteRecue),
          datePeremption: l.datePeremption,
          etatEmballage:  l.etatEmballage,
        })),
      });
      setBls(prev => [bl, ...prev]);
      getFournisseurs().then(list => setSuppliers(list.map(f => f.name))).catch(() => {});
      addToast(`${bl.lignes.length} produit(s) réceptionné(s) — ${bl.numeroBL}`, 'success');
      setLines([newLine()]);
      setNumeroBL('');
      setFourn('');
      setDate(new Date().toISOString().slice(0, 10));
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Erreur enregistrement', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>
      <StocksSidebar/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 44 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Gestion de stock</p>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>Réceptions</h1>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['form', 'history'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: view === v ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: view === v ? 'var(--fs-wine-700)' : '#fff',
                  color: view === v ? '#fff' : 'var(--fs-ink-500)',
                  fontFamily: 'var(--fs-font-sans)',
                }}>
                  {v === 'form' ? 'Nouveau BL' : `Historique (${bls.length + magRecs.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === 'form' ? (
          <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '16px 12px' : '20px 24px' }}>
            {/* BL Header */}
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '18px 20px', marginBottom: 16, boxShadow: 'var(--fs-shadow-sm)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px' }}>
                Entête du bon de livraison
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Fournisseur *</label>
                  <AutocompleteInput
                    value={fournisseur}
                    onChange={setFourn}
                    suggestions={suppliers}
                    placeholder="Nom du fournisseur ou sélectionner…"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>N° BL</label>
                  <input value={numeroBL} onChange={e => setNumeroBL(e.target.value)} placeholder="BL-2026-001"
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Date de réception</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--fs-font-sans)' }}/>
                </div>
              </div>
            </div>

            {/* Lines table */}
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)', marginBottom: 14 }}>
              <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 720 : undefined }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {['Produit', 'Qté attendue', 'Qté reçue', 'Date péremption', 'État emballage', 'Écart', ''].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const att = parseInt(line.qteAttendue) || 0;
                    const rec = parseInt(line.qteRecue) || 0;
                    const ecart = line.qteAttendue && line.qteRecue ? rec - att : null;
                    return (
                      <tr key={line.id} style={{ background: idx % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '8px 12px', minWidth: 240 }}>
                          <BLProductCell
                            products={products}
                            line={line}
                            onChange={patch => setLine(line.id, patch)}
                            onScanned={name => addToast(`✓ ${name} reconnu`, 'success')}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: 100 }}>
                          <input type="number" min={0} value={line.qteAttendue}
                            onChange={e => setLine(line.id, { qteAttendue: e.target.value })}
                            placeholder="0"
                            style={{ width: 80, padding: '6px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-mono)', outline: 'none', textAlign: 'center' }}/>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: 100 }}>
                          <input type="number" min={0} value={line.qteRecue}
                            onChange={e => setLine(line.id, { qteRecue: e.target.value })}
                            placeholder="0"
                            style={{ width: 80, padding: '6px 8px', border: '2px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--fs-font-mono)', outline: 'none', textAlign: 'center', background: 'var(--fs-wine-50)' }}/>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: 140 }}>
                          <input type="date" value={line.datePeremption}
                            onChange={e => setLine(line.id, { datePeremption: e.target.value })}
                            style={{ padding: '6px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'var(--fs-font-sans)' }}/>
                        </td>
                        <td style={{ padding: '8px 12px', minWidth: 130 }}>
                          <select value={line.etatEmballage} onChange={e => setLine(line.id, { etatEmballage: e.target.value as BLLine['etatEmballage'] })}
                            style={{ padding: '6px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', fontFamily: 'var(--fs-font-sans)', background: '#fff', color: line.etatEmballage === 'endommage' ? 'var(--fs-danger-700)' : 'var(--fs-ink-700)' }}>
                            <option value="">— État —</option>
                            <option value="bon">Bon état</option>
                            <option value="endommage">Endommagé</option>
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', minWidth: 60 }}>
                          {ecart !== null && (
                            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: ecart > 0 ? 'var(--fs-success-700)' : ecart < 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>
                              {ecart > 0 ? `+${ecart}` : ecart === 0 ? '=' : ecart}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={() => removeLine(line.id)} disabled={lines.length === 1}
                            style={{ background: 'none', border: 'none', cursor: lines.length > 1 ? 'pointer' : 'default', color: 'var(--fs-ink-300)', opacity: lines.length > 1 ? 1 : 0.3, display: 'flex' }}>
                            <I d={D.trash} size={14}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setLines(prev => [...prev, newLine()])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1.5px dashed var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-ink-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.plus} size={13}/> Ajouter une ligne
              </button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 24px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'var(--fs-font-sans)' }}>
                <I d={D.check} size={13}/> {loading ? 'Enregistrement…' : 'Valider la réception'}
              </button>
            </div>
          </div>
        ) : (
          // History view
          <div style={{ flex: '0 0 auto', overflowY: 'visible', overflowX: 'auto', padding: isNarrow ? '16px 12px' : '20px 24px' }}>

            {/* Filtre */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {([['tous', 'Tous'], ['moi', 'Par moi'], ['magazinier', 'Par magazinier']] as [HistoFilter, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setHistoFilter(key)} style={{
                  padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fs-font-sans)',
                  border: histoFilter === key ? 'none' : '1.5px solid var(--fs-line-2)',
                  background: histoFilter === key ? 'var(--fs-wine-700)' : '#fff',
                  color: histoFilter === key ? '#fff' : 'var(--fs-ink-500)',
                }}>
                  {label}
                  {key === 'magazinier' && magRecs.length > 0 && (
                    <span style={{ marginLeft: 6, background: histoFilter === key ? 'rgba(255,255,255,0.25)' : 'var(--fs-ivory)', padding: '0 5px', borderRadius: 8, fontSize: 10 }}>
                      {magRecs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Réceptions magazinier (backend) */}
            {(histoFilter === 'tous' || histoFilter === 'magazinier') && magRecs.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {histoFilter === 'tous' && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
                    Réceptions magazinier
                  </p>
                )}
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 640 : undefined }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        {['Fournisseur', 'Date', 'Produit', 'Qté reçue', 'Reçu par'].map(h => (
                          <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {magRecs.flatMap((r, ri) => r.items.map((item, i) => {
                        const isGest = r.creePar?.role === 'gestionnaire' || r.creePar?.role === 'patron';
                        return (
                          <tr key={`${r._id}-${i}`} style={{ background: ri % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                            <td style={{ padding: '9px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{i === 0 ? r.fournisseur : ''}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'left', fontSize: 12, color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-mono)', whiteSpace: 'nowrap' }}>{i === 0 ? new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{item.productName}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'left', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: '#16a34a' }}>+{item.quantity}</td>
                            <td style={{ padding: '9px 14px', textAlign: 'left' }}>
                              {isGest
                                ? <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--fs-wine-900)', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>Gestionnaire</span>
                                : <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--fs-gold-500)', color: '#fff', padding: '2px 8px', borderRadius: 8 }}>Magazinier · {r.creePar?.name ?? '—'}</span>}
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Réceptions gestionnaire (backend) */}
            {(histoFilter === 'tous' || histoFilter === 'moi') && (
              <div>
                {histoFilter === 'tous' && bls.length > 0 && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
                    Mes bons de livraison
                  </p>
                )}
                {bls.length === 0 && histoFilter === 'moi' && (
                  <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Aucun BL enregistré</div>
                )}
                {bls.map(bl => (
              <div key={bl._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, marginBottom: 14, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-mono)' }}>{bl.numeroBL}</span>
                    <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>{bl.fournisseur}</span>
                    <span style={{ fontSize: 12, color: 'var(--fs-ink-400)', fontFamily: 'var(--fs-font-mono)' }}>{bl.date}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                    background: bl.totalEcarts < 0 ? 'var(--fs-wine-100)' : bl.totalEcarts > 0 ? '#E8F0E5' : 'var(--fs-ivory)',
                    color: bl.totalEcarts < 0 ? 'var(--fs-danger-700)' : bl.totalEcarts > 0 ? 'var(--fs-success-700)' : 'var(--fs-ink-400)',
                  }}>
                    Écart total : {bl.totalEcarts > 0 ? `+${bl.totalEcarts}` : bl.totalEcarts}
                  </span>
                </div>
                <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 640 : undefined }}>
                  <thead>
                    <tr>
                      {['Produit', 'Qté attendue', 'Qté reçue', 'Date péremption', 'État', 'Écart'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bl.lignes.map((l, i) => {
                      const ecart = l.qteRecue - l.qteAttendue;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{l.productName}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{l.qteAttendue || '—'}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>+{l.qteRecue}</td>
                          <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>{l.datePeremption || '—'}</td>
                          <td style={{ padding: '9px 14px' }}>
                            {l.etatEmballage && (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: l.etatEmballage === 'bon' ? '#E8F0E5' : 'var(--fs-wine-100)', color: l.etatEmballage === 'bon' ? 'var(--fs-success-700)' : 'var(--fs-danger-700)' }}>
                                {l.etatEmballage === 'bon' ? 'Bon état' : 'Endommagé'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: ecart > 0 ? 'var(--fs-success-700)' : ecart < 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>
                            {l.qteAttendue ? (ecart > 0 ? `+${ecart}` : ecart === 0 ? '=' : ecart) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                ))}
              </div>
            )}

            {/* État vide global */}
            {histoFilter === 'tous' && bls.length === 0 && magRecs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Aucune réception enregistrée</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
