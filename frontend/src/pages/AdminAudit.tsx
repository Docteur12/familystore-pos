import React, { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';

type ActionType = 'annulation' | 'remise' | 'suppression' | 'connexion' | 'creation' | 'modification';

interface AuditEntry {
  id: string;
  date: string;
  heure: string;
  user: string;
  role: 'patron' | 'gestionnaire' | 'caissier';
  type: ActionType;
  detail: string;
  montant?: number;
  ticket?: string;
}

const AUDIT_DATA: AuditEntry[] = [
  { id: 'A001', date: '25/04/2026', heure: '14:32', user: 'Marie Tchapda',  role: 'caissier',     type: 'annulation',   detail: 'Ticket #TK-2847 annulé',                  montant: 8500,   ticket: 'TK-2847' },
  { id: 'A002', date: '25/04/2026', heure: '13:18', user: 'Aïcha Nguemo',   role: 'caissier',     type: 'remise',       detail: 'Remise 10% sur ticket #TK-2831',           montant: 1200,   ticket: 'TK-2831' },
  { id: 'A003', date: '25/04/2026', heure: '11:55', user: 'Samuel Onana',   role: 'gestionnaire', type: 'modification', detail: 'Prix modifié : Huile Végétale 5L → 3 200 XAF', montant: 3200 },
  { id: 'A004', date: '25/04/2026', heure: '09:40', user: 'Jean Domkam',    role: 'caissier',     type: 'remise',       detail: 'Remise 5% appliquée sur ticket #TK-2804',  montant: 750,    ticket: 'TK-2804' },
  { id: 'A005', date: '25/04/2026', heure: '08:05', user: 'Patron',         role: 'patron',       type: 'connexion',    detail: 'Connexion au tableau de bord admin' },
  { id: 'A006', date: '24/04/2026', heure: '17:44', user: 'Patrick Mbarga', role: 'gestionnaire', type: 'suppression',  detail: 'Produit "Biscuits XL 500g" supprimé du catalogue' },
  { id: 'A007', date: '24/04/2026', heure: '16:22', user: 'Patron',         role: 'patron',       type: 'creation',     detail: 'Compte créé pour Fatou Kouassi (caissier)' },
  { id: 'A008', date: '24/04/2026', heure: '15:10', user: 'Marie Tchapda',  role: 'caissier',     type: 'annulation',   detail: 'Ticket #TK-2790 annulé — article inexistant', montant: 4200,  ticket: 'TK-2790' },
  { id: 'A009', date: '24/04/2026', heure: '14:05', user: 'Samuel Onana',   role: 'gestionnaire', type: 'creation',     detail: 'Nouveau fournisseur : SOCAMAC Bafoussam enregistré' },
  { id: 'A010', date: '24/04/2026', heure: '12:30', user: 'Aïcha Nguemo',   role: 'caissier',     type: 'remise',       detail: 'Remise 15% sur ticket #TK-2775 (client fidèle)', montant: 2100, ticket: 'TK-2775' },
  { id: 'A011', date: '24/04/2026', heure: '10:15', user: 'Patron',         role: 'patron',       type: 'modification', detail: 'TVA modifiée : 19.25% (mise à jour légale)' },
  { id: 'A012', date: '23/04/2026', heure: '18:50', user: 'Jean Domkam',    role: 'caissier',     type: 'annulation',   detail: 'Ticket #TK-2741 annulé — doublon de vente', montant: 6800,  ticket: 'TK-2741' },
  { id: 'A013', date: '23/04/2026', heure: '16:35', user: 'Patrick Mbarga', role: 'gestionnaire', type: 'modification', detail: 'Stock corrigé : Riz 25kg — 42 → 38 unités' },
  { id: 'A014', date: '23/04/2026', heure: '14:20', user: 'Fatou Kouassi',  role: 'caissier',     type: 'remise',       detail: 'Remise 8% sur ticket #TK-2728',            montant: 960,    ticket: 'TK-2728' },
  { id: 'A015', date: '23/04/2026', heure: '09:00', user: 'Patron',         role: 'patron',       type: 'connexion',    detail: 'Connexion au tableau de bord admin' },
];

const TYPE_CONFIG: Record<ActionType, { label: string; bg: string; color: string; icon: string }> = {
  annulation:   { label: 'Annulation',   bg: '#FAE5DF', color: '#8B2C1A', icon: 'M18 6L6 18M6 6l12 12' },
  remise:       { label: 'Remise',       bg: '#FDF3DC', color: '#8B5A14', icon: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V7h5l8.59 8.59z M7 7h.01' },
  suppression:  { label: 'Suppression',  bg: '#FAE5DF', color: '#8B2C1A', icon: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2' },
  connexion:    { label: 'Connexion',    bg: '#EEF3FA', color: '#3A5E8F', icon: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3' },
  creation:     { label: 'Création',     bg: '#E8F0E5', color: '#3F6B3A', icon: 'M12 5v14M5 12h14' },
  modification: { label: 'Modification', bg: '#F0EAF7', color: '#6B3FA0', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
};

const ROLE_COLORS = {
  patron:       { bg: 'var(--fs-wine-50)',  color: 'var(--fs-wine-700)'    },
  gestionnaire: { bg: '#E8F0E5',            color: 'var(--fs-success-700)' },
  caissier:     { bg: '#EEF3FA',            color: '#3A5E8F'               },
};

const fmtN = (n: number) => n.toLocaleString('fr-FR');

function I({ d }: { d: string }) {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

export default function AdminAudit() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActionType | 'all'>('all');

  const filtered = AUDIT_DATA.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.user.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q) || (e.ticket || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || e.type === typeFilter;
    return matchSearch && matchType;
  });

  const counts = {
    annulations: AUDIT_DATA.filter(e => e.type === 'annulation').length,
    remises: AUDIT_DATA.filter(e => e.type === 'remise').length,
    suppressions: AUDIT_DATA.filter(e => e.type === 'suppression').length,
    modifications: AUDIT_DATA.filter(e => e.type === 'modification').length,
  };

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Audit & Logs</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ padding: '8px 12px 8px 34px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', width: 200, background: '#fff', fontFamily: 'var(--fs-font-sans)' }}/>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-400)' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={11} cy={11} r={8}/><path d="M21 21l-4.35-4.35"/></svg>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 28px', flexShrink: 0 }}>
          {[
            { label: 'Annulations', value: counts.annulations, bg: '#FAE5DF', color: '#8B2C1A' },
            { label: 'Remises',     value: counts.remises,     bg: '#FDF3DC', color: '#8B5A14' },
            { label: 'Suppressions',value: counts.suppressions,bg: '#FAE5DF', color: '#8B2C1A' },
            { label: 'Modifications',value: counts.modifications,bg:'#F0EAF7',color: '#6B3FA0' },
            { label: 'Total entrées',value: AUDIT_DATA.length, bg: '#fff',    color: 'var(--fs-ink-700)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '10px 16px', minWidth: 90 }}>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, padding: '0 28px 12px', flexShrink: 0 }}>
          {(['all', 'annulation', 'remise', 'suppression', 'connexion', 'creation', 'modification'] as const).map(t => {
            const active = typeFilter === t;
            const cfg = t !== 'all' ? TYPE_CONFIG[t] : null;
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: active ? (cfg ? cfg.bg : 'var(--fs-ink-200)') : '#fff',
                  color: active ? (cfg ? cfg.color : 'var(--fs-ink-700)') : 'var(--fs-ink-500)',
                  outline: active ? `2px solid ${cfg ? cfg.color : 'var(--fs-ink-400)'}` : '1.5px solid var(--fs-line)' }}>
                {t === 'all' ? 'Tous' : TYPE_CONFIG[t].label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--fs-ivory)' }}>
                  {['Date / Heure', 'Utilisateur', 'Type', 'Détail', 'Montant'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>Aucune entrée trouvée</td></tr>
                )}
                {filtered.map((entry, i) => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const rc = ROLE_COLORS[entry.role];
                  return (
                    <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{entry.date}</div>
                        <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{entry.heure}</div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>{entry.user}</div>
                        <span style={{ background: rc.bg, color: rc.color, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{entry.role}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <I d={cfg.icon}/> {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--fs-ink-700)', maxWidth: 320 }}>
                        {entry.detail}
                        {entry.ticket && <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-400)', background: 'var(--fs-ivory)', padding: '1px 6px', borderRadius: 4 }}>#{entry.ticket}</span>}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontSize: 12, fontWeight: 700, color: entry.montant ? 'var(--fs-danger-700)' : 'var(--fs-ink-300)' }}>
                        {entry.montant ? `-${fmtN(entry.montant)} XAF` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
