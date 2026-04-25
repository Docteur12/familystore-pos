import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { getUsers, UserRecord } from '../api/auth';

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fmtN = (n: number) => n.toLocaleString('fr-FR');

interface Presence { status: 'present' | 'absent' | 'repos'; horaire: string; caisse: string; }
const PRESENCE: Record<string, Presence> = {
  default: { status: 'present', horaire: '08:00–16:00', caisse: 'C01' },
};
function getPresence(id: string, role: string): Presence {
  const h = id.charCodeAt(0);
  const statuses: Presence['status'][] = ['present', 'present', 'present', 'repos', 'absent'];
  return {
    status:  statuses[h % statuses.length],
    horaire: ['08:00–16:00','04:00–12:00','12:00–20:00','Repos','—'][h % 5],
    caisse:  role === 'gestionnaire' ? 'Stock' : `C0${1 + h % 3}`,
  };
}
function getPerf(id: string) {
  const h = id.charCodeAt(0);
  return {
    ventes30:  (role: string) => role === 'gestionnaire' ? 0 : 100 + h % 500,
    panier:    12000 + (h * 7) % 5000,
    ca30:      (h: number, r: string) => r === 'gestionnaire' ? 0 : (100 + h % 500) * (12000 + (h * 7) % 5000),
    stars:     3 + h % 3,
  };
}

const STATUS_STYLE = {
  present: { bg: '#E8F0E5', color: '#3F6B3A', label: 'En service' },
  repos:   { bg: '#F7ECD4', color: '#8B5A14', label: 'Repos'     },
  absent:  { bg: '#FAE5DF', color: '#8B2C1A', label: 'Absent'    },
};

export default function AdminEquipe() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  useEffect(() => { getUsers().then(us => setUsers(us.filter(u => u.role !== 'patron'))).catch(() => {}); }, []);

  const staff = users.length > 0 ? users : [
    { _id: '1', name: 'Aïcha Nguemo',   email: '', role: 'caissier'     as const },
    { _id: '2', name: 'Marie Tchapda',  email: '', role: 'caissier'     as const },
    { _id: '3', name: 'Samuel Onana',   email: '', role: 'gestionnaire' as const },
    { _id: '4', name: 'Jean Domkam',    email: '', role: 'caissier'     as const },
    { _id: '5', name: 'Fatou Kouassi',  email: '', role: 'caissier'     as const },
    { _id: '6', name: 'Patrick Mbarga', email: '', role: 'gestionnaire' as const },
  ];

  const present = staff.filter(u => getPresence(u._id, u.role).status === 'present').length;
  const repos   = staff.filter(u => getPresence(u._id, u.role).status === 'repos').length;
  const absent  = staff.filter(u => getPresence(u._id, u.role).status === 'absent').length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Équipe · {staff.length} collaborateurs</h1>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 14, padding: '14px 28px', flexShrink: 0 }}>
          {[
            { label: 'En service', count: present, bg: '#E8F0E5', color: '#3F6B3A' },
            { label: 'Au repos',   count: repos,   bg: '#F7ECD4', color: '#8B5A14' },
            { label: 'Absents',    count: absent,  bg: '#FAE5DF', color: '#8B2C1A' },
            { label: 'Total',      count: staff.length, bg: '#fff', color: 'var(--fs-ink-700)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 18px', minWidth: 100 }}>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Collaborateur', 'Rôle', 'Poste', 'Horaire', 'Présence', 'Ventes / 30j', 'CA / 30j', 'Performance'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: i >= 5 ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((u, i) => {
                  const pr   = getPresence(u._id, u.role);
                  const h    = u._id.charCodeAt(0);
                  const ventes = u.role === 'gestionnaire' ? 0 : 100 + h % 500;
                  const panier = 12000 + (h * 7) % 5000;
                  const ca    = u.role === 'gestionnaire' ? 0 : ventes * panier;
                  const stars  = 3 + h % 3;
                  const st    = STATUS_STYLE[pr.status];
                  const color = avatarColor(u.name);
                  return (
                    <tr key={u._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials(u.name)}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{u.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{u.email || `${u.name.split(' ')[0].toLowerCase()}@familystore.cm`}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: u.role === 'caissier' ? 'var(--fs-wine-50)' : '#E8F0E5', color: u.role === 'caissier' ? 'var(--fs-wine-700)' : 'var(--fs-success-700)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                          {u.role === 'caissier' ? 'Caissier' : 'Gestionnaire'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--fs-ink-600)', fontWeight: 600 }}>{pr.caisse}</td>
                      <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-ink-500)' }}>{pr.horaire}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: ventes > 0 ? 'var(--fs-ink-800)' : 'var(--fs-ink-300)' }}>{ventes > 0 ? ventes : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--fs-font-mono)', color: ca > 0 ? 'var(--fs-wine-700)' : 'var(--fs-ink-300)' }}>{ca > 0 ? fmtN(ca) : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <span>{[1,2,3,4,5].map(s => <span key={s} style={{ color: s <= stars ? '#D1A660' : 'var(--fs-line-2)', fontSize: 12 }}>★</span>)}</span>
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
