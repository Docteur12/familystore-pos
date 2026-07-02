import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import ToastContainer, { useToast } from '../components/Toast';
import { getAuditLogs, getAuditStats, AuditLogEntry, AuditStats } from '../api/audit';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Config types ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  vente:        { label: 'Vente',        bg: '#E8F0E5', color: '#3F6B3A', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h4' },
  connexion:    { label: 'Connexion',    bg: '#EEF3FA', color: '#3A5E8F', icon: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3' },
  creation:     { label: 'Création',     bg: '#E8F5E8', color: '#2E7D2E', icon: 'M12 5v14M5 12h14' },
  modification: { label: 'Modification', bg: '#F0EAF7', color: '#6B3FA0', icon: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z' },
  suppression:  { label: 'Suppression',  bg: 'var(--fs-wine-100)', color: 'var(--fs-wine-700)', icon: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2' },
};

const MODULE_CFG: Record<string, { label: string; color: string }> = {
  auth:          { label: 'Auth',         color: '#3A5E8F' },
  utilisateurs:  { label: 'Utilisateurs', color: '#6B3FA0' },
  produits:      { label: 'Produits',     color: '#8B5A14' },
  ventes:        { label: 'Ventes',       color: '#3F6B3A' },
  stock:         { label: 'Stock',        color: '#1D7A4E' },
  caisses:       { label: 'Caisses',      color: 'var(--fs-wine-700)' },
  'paramètres':  { label: 'Paramètres',   color: '#4A4A6A' },
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  patron:       { bg: 'var(--fs-wine-50)',  color: 'var(--fs-wine-700)'    },
  gestionnaire: { bg: '#E8F0E5',            color: '#3F6B3A'               },
  caissier:     { bg: '#EEF3FA',            color: '#3A5E8F'               },
  magazinier:   { bg: '#E8EFF7',            color: '#1D4E7A'               },
};

function I({ d, size = 12 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

// ── Format date ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso);
  return {
    date:  d.toLocaleDateString('fr-FR'),
    heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(entries: AuditLogEntry[]) {
  const header = 'Date;Heure;Utilisateur;Rôle;Type;Module;Détail';
  const rows = entries.map(e => {
    const { date, heure } = fmtDate(e.createdAt);
    return [date, heure, e.actorName, e.actorRole, e.type, e.module, `"${e.detail}"`].join(';');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const ALL_TYPES   = ['all', 'vente', 'connexion', 'creation', 'modification', 'suppression'] as const;
const ALL_MODULES = ['all', 'auth', 'utilisateurs', 'produits', 'ventes', 'stock', 'caisses', 'paramètres'] as const;
type TypeFilter   = typeof ALL_TYPES[number];
type ModuleFilter = typeof ALL_MODULES[number];

export default function AdminAudit() {
  const { toasts, addToast, removeToast } = useToast();
  const isMobile = useIsMobile();
  const isNarrow = useIsMobile(1024);

  const [entries,    setEntries]    = useState<AuditLogEntry[]>([]);
  const [stats,      setStats]      = useState<AuditStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [modFilter,  setModFilter]  = useState<ModuleFilter>('all');
  const [lastRefresh,setLastRefresh]= useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, s] = await Promise.all([
        getAuditLogs({ limit: 300 }),
        getAuditStats(),
      ]);
      setEntries(data);
      setStats(s);
      setLastRefresh(new Date());
    } catch {
      if (!silent) addToast('Erreur chargement des logs', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
    // Rafraîchissement automatique toutes les 30 s
    timerRef.current = setInterval(() => load(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // ── Filtrage local ────────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.actorName.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q) ||
      e.module.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || e.type   === typeFilter;
    const matchMod  = modFilter  === 'all' || e.module === modFilter;
    return matchSearch && matchType && matchMod;
  });

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isNarrow ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'stretch' : 'center', justifyContent: 'space-between', gap: isNarrow ? 10 : 16 }}>
            <div style={{ paddingLeft: isMobile ? 52 : 0 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Audit & Logs</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Refresh status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fs-ink-400)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }}/>
                Mis à jour {relTime(lastRefresh.toISOString())}
              </div>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  style={{ padding: '8px 12px 8px 34px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, fontSize: 12, outline: 'none', width: 200, background: '#fff', fontFamily: 'var(--fs-font-sans)' }}
                />
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fs-ink-400)' }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx={11} cy={11} r={8}/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </span>
              </div>
              {/* Export */}
              <button
                onClick={() => exportCSV(filtered)}
                disabled={filtered.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 8, background: 'var(--fs-wine-700)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer', opacity: filtered.length === 0 ? 0.5 : 1 }}
              >
                <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" size={13}/> Exporter CSV
              </button>
              {/* Refresh manuel */}
              <button
                onClick={() => load()}
                style={{ padding: '7px 10px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', cursor: 'pointer', color: 'var(--fs-ink-500)', display: 'flex', alignItems: 'center' }}
                title="Rafraîchir"
              >
                <I d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" size={13}/>
              </button>
            </div>
          </div>
        </div>

        {/* Compteurs */}
        <div style={{ display: 'flex', gap: 10, padding: isNarrow ? '12px 16px' : '12px 28px', flexShrink: 0, flexWrap: 'wrap' }}>
          {stats && [
            { label: 'Total',         value: stats.total,        bg: '#fff',      color: 'var(--fs-ink-700)' },
            { label: 'Ventes',        value: stats.vente,        bg: '#E8F0E5',   color: '#3F6B3A'           },
            { label: 'Connexions',    value: stats.connexion,    bg: '#EEF3FA',   color: '#3A5E8F'           },
            { label: 'Créations',     value: stats.creation,     bg: '#E8F5E8',   color: '#2E7D2E'           },
            { label: 'Modifications', value: stats.modification, bg: '#F0EAF7',   color: '#6B3FA0'           },
            { label: 'Suppressions',  value: stats.suppression,  bg: 'var(--fs-wine-100)',   color: 'var(--fs-wine-700)'           },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '8px 14px', minWidth: 80 }}>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filtres type */}
        <div style={{ display: 'flex', gap: 6, padding: isNarrow ? '0 16px 6px' : '0 28px 6px', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>Type :</span>
          {ALL_TYPES.map(t => {
            const active = typeFilter === t;
            const cfg    = t !== 'all' ? TYPE_CFG[t] : null;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} style={{
                padding: '4px 11px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: active ? (cfg ? cfg.bg : 'var(--fs-ink-200)') : '#fff',
                color:      active ? (cfg ? cfg.color : 'var(--fs-ink-700)') : 'var(--fs-ink-500)',
                outline:    active ? `2px solid ${cfg ? cfg.color : 'var(--fs-ink-400)'}` : '1.5px solid var(--fs-line)',
              }}>
                {t === 'all' ? 'Tous' : TYPE_CFG[t].label}
              </button>
            );
          })}
        </div>

        {/* Filtres module */}
        <div style={{ display: 'flex', gap: 6, padding: isNarrow ? '0 16px 12px' : '0 28px 12px', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', fontWeight: 600, alignSelf: 'center', marginRight: 4 }}>Module :</span>
          {ALL_MODULES.map(m => {
            const active = modFilter === m;
            const cfg    = m !== 'all' ? MODULE_CFG[m] : null;
            return (
              <button key={m} onClick={() => setModFilter(m)} style={{
                padding: '4px 11px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: active ? (cfg ? cfg.color + '18' : 'var(--fs-ink-200)') : '#fff',
                color:      active ? (cfg ? cfg.color : 'var(--fs-ink-700)') : 'var(--fs-ink-500)',
                outline:    active ? `2px solid ${cfg ? cfg.color : 'var(--fs-ink-400)'}` : '1.5px solid var(--fs-line)',
              }}>
                {m === 'all' ? 'Tous' : MODULE_CFG[m]?.label ?? m}
              </button>
            );
          })}
        </div>

        {/* Résultats count */}
        <div style={{ padding: isNarrow ? '0 16px 8px' : '0 28px 8px', fontSize: 11, color: 'var(--fs-ink-400)', flexShrink: 0 }}>
          {filtered.length} entrée{filtered.length !== 1 ? 's' : ''}{search || typeFilter !== 'all' || modFilter !== 'all' ? ' (filtrées)' : ''}
        </div>

        {/* Table */}
        <div style={{ flex: isNarrow ? '0 0 auto' : 1, overflowY: isNarrow ? 'visible' : 'auto', padding: isNarrow ? '0 16px 28px' : '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, padding: '60px 0' }}>Chargement…</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
              <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse', minWidth: isNarrow ? 760 : undefined }}>
                <thead>
                  <tr style={{ background: 'var(--fs-ivory)' }}>
                    {['Date / Heure', 'Utilisateur', 'Type', 'Module', 'Détail'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13 }}>
                        {entries.length === 0
                          ? 'Aucun événement enregistré — les opérations du système apparaîtront ici en temps réel.'
                          : 'Aucune entrée correspondant aux filtres.'}
                      </td>
                    </tr>
                  ) : filtered.map((entry, i) => {
                    const { date, heure } = fmtDate(entry.createdAt);
                    const tc  = TYPE_CFG[entry.type]   ?? { label: entry.type,   bg: '#f5f5f5', color: '#666', icon: 'M12 12h.01' };
                    const mc  = MODULE_CFG[entry.module]?? { label: entry.module, color: '#666' };
                    const rc  = ROLE_COLORS[entry.actorRole] ?? { bg: '#f5f5f5', color: '#666' };
                    return (
                      <tr key={entry._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        {/* Date/heure */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-700)' }}>{date}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 1 }}>{heure}</div>
                        </td>
                        {/* Utilisateur */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-800)' }}>{entry.actorName}</div>
                          <span style={{ background: rc.bg, color: rc.color, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {entry.actorRole}
                          </span>
                        </td>
                        {/* Type */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: tc.bg, color: tc.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <I d={tc.icon}/> {tc.label}
                          </span>
                        </td>
                        {/* Module */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: mc.color, background: mc.color + '15', padding: '2px 8px', borderRadius: 6, textTransform: 'capitalize' }}>
                            {mc.label}
                          </span>
                        </td>
                        {/* Détail */}
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fs-ink-700)', maxWidth: 380 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.detail}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
