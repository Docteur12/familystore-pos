import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import { getUserActivity, UserActivity } from '../api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#C2566B','#7A9EC2','#7AB87A','#C2A07A','#9A7AC2','#7ABFBF'];
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length];
const initials    = (s: string) => s.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

function relTime(iso: string | Date | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleKey = 'patron' | 'gestionnaire' | 'caissier' | 'magazinier';

interface PermAction {
  label: string; desc: string;
  patron: boolean; gestionnaire: boolean; caissier: boolean; magazinier: boolean;
}
interface PermSection { section: string; actions: PermAction[]; }

// ── Role metadata ─────────────────────────────────────────────────────────────

const ROLE_META: Record<RoleKey, { label: string; desc: string; bg: string; color: string; border: string }> = {
  patron:       { label: 'Patron',       desc: 'Accès total',               bg: 'var(--fs-wine-50)', color: 'var(--fs-wine-700)', border: 'rgba(122,29,46,0.2)'  },
  gestionnaire: { label: 'Gestionnaire', desc: 'Stock & approvisionnement', bg: '#E8F0E5',           color: '#3F6B3A',            border: 'rgba(90,139,83,0.2)'  },
  caissier:     { label: 'Caissier',     desc: 'Caisse uniquement',         bg: '#EEF3FA',           color: '#3A5E8F',            border: 'rgba(58,94,143,0.2)'  },
  magazinier:   { label: 'Magazinier',   desc: 'Entrepôt & réceptions',     bg: '#FEF3C7',           color: '#B45309',            border: 'rgba(180,83,9,0.2)'   },
};

const ROLE_ORDER: RoleKey[] = ['patron', 'gestionnaire', 'caissier', 'magazinier'];

// ── Permissions matrix ────────────────────────────────────────────────────────

const PERMS: PermSection[] = [
  {
    section: 'Caisse',
    actions: [
      { label: 'Ouvrir une vente',        desc: 'Créer un nouveau ticket de caisse',          patron: true,  gestionnaire: false, caissier: true,  magazinier: false },
      { label: 'Appliquer une remise',     desc: "Modifier le prix d'un article ou du total",  patron: true,  gestionnaire: false, caissier: true,  magazinier: false },
      { label: 'Annuler un ticket',        desc: 'Annuler une vente en cours',                 patron: true,  gestionnaire: false, caissier: true,  magazinier: false },
      { label: 'Rembourser une vente',     desc: 'Émettre un remboursement',                   patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Accepter paiement mobile', desc: 'Valider un paiement Mobile Money',           patron: true,  gestionnaire: false, caissier: true,  magazinier: false },
    ],
  },
  {
    section: 'Stock & Entrepôt',
    actions: [
      { label: 'Consulter le stock',       desc: 'Voir les niveaux de stock en temps réel',    patron: true,  gestionnaire: true,  caissier: false, magazinier: true  },
      { label: 'Ajouter une réception',    desc: 'Enregistrer une livraison fournisseur',      patron: true,  gestionnaire: true,  caissier: false, magazinier: true  },
      { label: 'Créer une demande',        desc: 'Demander un réapprovisionnement',            patron: true,  gestionnaire: true,  caissier: false, magazinier: true  },
      { label: 'Modifier un produit',      desc: 'Changer le prix, le nom, la catégorie',      patron: true,  gestionnaire: true,  caissier: false, magazinier: false },
      { label: 'Créer un produit',         desc: 'Ajouter un nouveau produit au catalogue',    patron: true,  gestionnaire: true,  caissier: false, magazinier: false },
      { label: 'Supprimer un produit',     desc: 'Retirer un produit du catalogue',            patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Gérer les fournisseurs',   desc: 'Ajouter / modifier les fournisseurs',        patron: true,  gestionnaire: true,  caissier: false, magazinier: false },
      { label: 'Faire un inventaire',      desc: 'Lancer et valider un inventaire complet',    patron: true,  gestionnaire: true,  caissier: false, magazinier: true  },
      { label: 'Imprimer des étiquettes',  desc: 'Générer et imprimer des étiquettes produits',patron: true,  gestionnaire: true,  caissier: false, magazinier: false },
      { label: 'Voir les dépôts',          desc: 'Consulter et gérer les dépôts de stockage', patron: true,  gestionnaire: true,  caissier: false, magazinier: true  },
    ],
  },
  {
    section: 'Personnel',
    actions: [
      { label: "Voir l'équipe",            desc: 'Consulter la liste des collaborateurs',      patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Créer un caissier',        desc: 'Ajouter un nouveau compte caissier',         patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Créer un gestionnaire',    desc: 'Ajouter un nouveau compte gestionnaire',     patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Réinitialiser un PIN',     desc: "Modifier le PIN d'accès caisse",             patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Désactiver un compte',     desc: "Bloquer l'accès d'un collaborateur",         patron: true,  gestionnaire: false, caissier: false, magazinier: false },
    ],
  },
  {
    section: 'Rapports & Comptabilité',
    actions: [
      { label: 'Voir le tableau de bord',  desc: "KPIs, chiffre d'affaires, statistiques",    patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Consulter les rapports',   desc: 'Rapports mensuels et comparaisons',          patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Voir la comptabilité',     desc: 'Compte de résultat, TVA, charges',           patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Exporter les données',     desc: 'Export Excel / PDF des rapports',            patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: "Consulter l'audit",        desc: 'Journal des actions sensibles',              patron: true,  gestionnaire: false, caissier: false, magazinier: false },
    ],
  },
  {
    section: 'Système',
    actions: [
      { label: 'Modifier les paramètres',  desc: 'Infos magasin, TVA, devise, imprimantes',   patron: true,  gestionnaire: false, caissier: false, magazinier: false },
      { label: 'Gérer les rôles',          desc: 'Modifier les permissions de chaque rôle',   patron: true,  gestionnaire: false, caissier: false, magazinier: false },
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Check({ on }: { on: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on ? (
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E8F0E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#3F6B3A" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
      ) : (
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--fs-ink-300)" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
      )}
    </div>
  );
}

function UserCard({ u }: { u: UserActivity }) {
  const color        = avatarColor(u.name);
  const isActive     = u.actionsToday > 0;
  const meta         = ROLE_META[u.role as RoleKey] ?? ROLE_META.caissier;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          {initials(u.name)}
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: isActive ? '#22c55e' : '#d1d5db', border: '2px solid #fff' }}/>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ background: meta.bg, color: meta.color, fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 4, border: `1px solid ${meta.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</span>
          <span style={{ fontSize: 10, color: 'var(--fs-ink-400)', fontFamily: 'var(--fs-font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
        </div>
      </div>
      {/* Activity */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#16a34a' : 'var(--fs-ink-300)' }}>
          {isActive ? `${u.actionsToday} action${u.actionsToday > 1 ? 's' : ''}` : 'Inactif auj.'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fs-ink-300)', marginTop: 1 }}>{relTime(u.lastActionAt)}</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: 66, background: '#f3f4f6', borderRadius: 10, animation: 'pulse 1.5s ease-in-out infinite' }}/>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminRoles() {
  const [users,       setUsers]       = useState<UserActivity[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [permFilter,  setPermFilter]  = useState<RoleKey | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getUserActivity();
      setUsers(data);
      setLastRefresh(new Date());
    } catch {}
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const byRole    = (role: string) => users.filter(u => u.role === role);
  const activeToday = users.filter(u => u.actionsToday > 0).length;
  const nonPatron   = users.filter(u => u.role !== 'patron').length;

  const visiblePerms = permFilter
    ? PERMS.map(s => ({ ...s, actions: s.actions.filter(a => a[permFilter]) })).filter(s => s.actions.length > 0)
    : PERMS;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>

        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Rôles & Accès</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}/>
                <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Actualisé {relTime(lastRefresh)}</span>
              </div>
              <button onClick={() => load()}
                style={{ padding: '6px 14px', border: '1.5px solid var(--fs-line)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                Actualiser
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {([
              { label: 'Caissiers',     count: byRole('caissier').length,    bg: ROLE_META.caissier.bg,     color: ROLE_META.caissier.color,     border: ROLE_META.caissier.border     },
              { label: 'Gestionnaires', count: byRole('gestionnaire').length, bg: ROLE_META.gestionnaire.bg, color: ROLE_META.gestionnaire.color, border: ROLE_META.gestionnaire.border },
              { label: 'Magaziniers',   count: byRole('magazinier').length,   bg: ROLE_META.magazinier.bg,   color: ROLE_META.magazinier.color,   border: ROLE_META.magazinier.border   },
              { label: 'Total membres', count: nonPatron,   bg: '#fff',    color: 'var(--fs-ink-700)', border: 'var(--fs-line)'             },
              { label: 'Actifs auj.',   count: activeToday, bg: '#F0FDF4', color: '#166534',           border: 'rgba(34,197,94,0.3)'         },
            ] as { label: string; count: number; bg: string; color: string; border: string }[]).map(k => (
              <div key={k.label} style={{ flex: 1, background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--fs-font-mono)', color: k.color, lineHeight: 1 }}>
                  {loading ? '—' : k.count}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: k.color, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Members & Activity */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Membres & Activité
            </div>
            {loading ? <Skeleton/> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {ROLE_ORDER.map(roleKey => {
                  const members = byRole(roleKey);
                  if (members.length === 0) return null;
                  const meta = ROLE_META[roleKey];
                  return (
                    <div key={roleKey}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{meta.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{meta.desc}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', marginLeft: 'auto' }}>
                          {members.length} membre{members.length > 1 ? 's' : ''}
                          {members.filter(m => m.actionsToday > 0).length > 0 && (
                            <span style={{ marginLeft: 8, color: '#16a34a' }}>· {members.filter(m => m.actionsToday > 0).length} actif{members.filter(m => m.actionsToday > 0).length > 1 ? 's' : ''} auj.</span>
                          )}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                        {members.map(u => <UserCard key={u._id} u={u}/>)}
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--fs-ink-300)', fontSize: 13, padding: '20px 0' }}>
                    Aucun utilisateur trouvé.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Permissions matrix */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Matrix toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Matrice des permissions</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Filtrer :</span>
                {([null, ...ROLE_ORDER] as (RoleKey | null)[]).map(r => {
                  const active = r === permFilter;
                  const label  = r === null ? 'Tous' : ROLE_META[r].label;
                  const meta   = r ? ROLE_META[r] : null;
                  return (
                    <button key={label} onClick={() => setPermFilter(r)}
                      style={{
                        padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border:     active ? `1.5px solid ${meta?.border ?? 'var(--fs-wine-700)'}` : '1.5px solid var(--fs-line)',
                        background: active ? (meta?.bg ?? 'var(--fs-wine-50)') : '#fff',
                        color:      active ? (meta?.color ?? 'var(--fs-wine-700)') : 'var(--fs-ink-500)',
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <table className="fs-grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--fs-ivory)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', width: '37%' }}>Action</th>
                  {ROLE_ORDER.map(r => {
                    const meta = ROLE_META[r];
                    return (
                      <th key={r} style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid var(--fs-line)', width: '15.75%' }}>
                        <span style={{ background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visiblePerms.map(section => (
                  <React.Fragment key={section.section}>
                    <tr>
                      <td colSpan={5} style={{ padding: '10px 20px 6px', background: 'var(--fs-ivory)', borderTop: '2px solid var(--fs-line)', borderBottom: '1px solid var(--fs-line)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{section.section}</span>
                      </td>
                    </tr>
                    {section.actions.map((action, i) => (
                      <tr key={action.label} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF9', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '10px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{action.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>{action.desc}</div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}><Check on={action.patron}/></td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}><Check on={action.gestionnaire}/></td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}><Check on={action.caissier}/></td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}><Check on={action.magazinier}/></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, padding: '10px 16px', background: 'var(--fs-wine-50)', border: '1px solid rgba(122,29,46,0.15)', borderRadius: 10, fontSize: 11, color: 'var(--fs-wine-700)', fontWeight: 600 }}>
            Ces permissions sont définies par le système et s'appliquent automatiquement à tous les utilisateurs selon leur rôle.
          </div>

          <div style={{ height: 24 }}/>
        </div>
      </main>
    </div>
  );
}
