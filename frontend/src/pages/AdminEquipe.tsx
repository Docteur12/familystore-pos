import React, { useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { getUsers, UserRecord } from '../api/auth';
import { getCaisses, CaisseRecord } from '../api/caisses';

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF'];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const ROLE_LABEL: Record<string, string> = {
  caissier:     'Caissier',
  gestionnaire: 'Gestionnaire',
  magazinier:   'Magazinier',
};
const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  caissier:     { bg: 'var(--fs-wine-50)',  color: 'var(--fs-wine-700)'    },
  gestionnaire: { bg: '#E8F0E5',            color: '#3F6B3A'               },
  magazinier:   { bg: '#E8EFF7',            color: '#1D4E7A'               },
};

export default function AdminEquipe() {
  const [users,   setUsers]   = useState<UserRecord[]>([]);
  const [caisses, setCaisses] = useState<CaisseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getUsers().catch(() => [] as UserRecord[]),
      getCaisses().catch(() => [] as CaisseRecord[]),
    ]).then(([u, c]) => {
      setUsers(u.filter(x => x.role !== 'patron'));
      setCaisses(c);
      setLoading(false);
    });
  }, []);

  // Map caisseId → caisse
  const caisseById = new Map(caisses.map(c => [c._id, c]));
  const getCaisseName = (u: UserRecord) => {
    if (u.role !== 'caissier') return u.role === 'gestionnaire' ? 'Stock' : 'Entrepôt';
    if (!u.caisseId) return '— Non assigné';
    const c = caisseById.get(u.caisseId);
    return c ? `${c.nom} (${c.code})` : '—';
  };

  const byRole = (role: string) => users.filter(u => u.role === role).length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Personnel</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>
            Équipe · {users.length} collaborateur{users.length !== 1 ? 's' : ''}
          </h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, padding: '14px 28px', flexShrink: 0 }}>
          {[
            { label: 'Caissiers',     count: byRole('caissier'),     ...ROLE_COLOR.caissier     },
            { label: 'Gestionnaires', count: byRole('gestionnaire'), ...ROLE_COLOR.gestionnaire },
            { label: 'Magaziniers',   count: byRole('magazinier'),   ...ROLE_COLOR.magazinier   },
            { label: 'Total',         count: users.length, bg: '#fff', color: 'var(--fs-ink-700)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 18px', minWidth: 110 }}>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, padding: '60px 0' }}>Chargement…</div>
          ) : users.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, padding: '60px 0' }}>
              Aucun collaborateur trouvé.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Collaborateur', 'Rôle', 'Poste / Caisse', 'Email', 'Téléphone'].map((h, i) => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)',
                        textTransform: 'uppercase', letterSpacing: '0.1em',
                        borderBottom: '1px solid var(--fs-line)', background: 'var(--fs-ivory)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const color    = avatarColor(u.name);
                    const rStyle   = ROLE_COLOR[u.role] ?? { bg: '#f5f5f5', color: '#666' };
                    const postName = getCaisseName(u);
                    const phone    = (u as any).phone as string | undefined;
                    return (
                      <tr key={u._id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--fs-ivory)', borderBottom: '1px solid var(--fs-line)' }}>
                        {/* Nom */}
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {initials(u.name)}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{u.name}</span>
                          </div>
                        </td>
                        {/* Rôle */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: rStyle.bg, color: rStyle.color, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </td>
                        {/* Poste */}
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: u.caisseId ? 'var(--fs-wine-700)' : 'var(--fs-ink-400)' }}>
                          {postName}
                        </td>
                        {/* Email */}
                        <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--fs-ink-500)', fontFamily: 'var(--fs-font-mono)' }}>
                          {u.email}
                        </td>
                        {/* Téléphone */}
                        <td style={{ padding: '10px 14px', fontSize: 11, color: phone ? 'var(--fs-ink-600)' : 'var(--fs-ink-300)' }}>
                          {phone || '—'}
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
