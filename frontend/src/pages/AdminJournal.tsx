import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { authHeaders } from '../api/http';

interface Sale { _id: string; total: number; paymentMethod: string; createdAt: string; amountPaid: number; }

const fmtN = (n: number) => n.toLocaleString('fr-FR');
function I({ d, size = 14 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}
const D = {
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  cash:    'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  mobile:  'M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z',
  card:    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z',
};
const PAY_ICONS: Record<string, string> = { espèces: D.cash, 'mobile money': D.mobile, carte: D.card };
const PAY_LABELS: Record<string, string> = { especes: 'Espèces', mobile: 'Mobile Money', carte: 'Carte' };

async function getSales(): Promise<Sale[]> {
  try {
    const res = await fetch('/api/sales', { headers: authHeaders() });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

const MOCK_SALES: Sale[] = Array.from({ length: 20 }, (_, i) => ({
  _id: `sale_${i}`,
  total: 2000 + Math.round(Math.random() * 30000),
  paymentMethod: ['espèces','mobile','carte'][i % 3],
  amountPaid: 0,
  createdAt: new Date(Date.now() - i * 18 * 60_000).toISOString(),
}));

export default function AdminJournal() {
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = async () => {
    setLoading(true);
    const data = await getSales();
    setSales(data.length > 0 ? data : MOCK_SALES);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const displayed = sales.filter(s =>
    !search || s._id.includes(search) || s.paymentMethod.includes(search.toLowerCase())
  );
  const totalCA = displayed.reduce((s, x) => s + x.total, 0);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Pilotage</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Journal des ventes</h1>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher ticket, paiement..."
                style={{ padding: '8px 12px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'var(--fs-font-sans)', width: 240 }}/>
              <button onClick={load} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)' }}>
                <I d={D.refresh} size={14}/>
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 28px', background: 'var(--fs-wine-50)', borderBottom: '1px solid var(--fs-line)', flexShrink: 0, display: 'flex', gap: 24 }}>
          <div><span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Tickets : </span><span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>{displayed.length}</span></div>
          <div><span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>CA total : </span><span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(totalCA)} XAF</span></div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--fs-ink-300)', fontSize: 14 }}>Chargement…</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Ticket #', 'Paiement', 'Heure', 'Total'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, i) => {
                  const pm = PAY_LABELS[s.paymentMethod] ?? s.paymentMethod;
                  const icon = PAY_ICONS[s.paymentMethod.toLowerCase()] ?? D.cash;
                  return (
                    <tr key={s._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-wine-700)' }}>#{s._id.slice(-6).toUpperCase()}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fs-ink-600)' }}>
                          <I d={icon} size={12}/> {pm}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)' }}>
                        {new Date(s.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-900)' }}>
                        {fmtN(s.total)} XAF
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
