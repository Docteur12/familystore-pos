import React, { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';

const ROLES = ['Patron', 'Gestionnaire', 'Caissier'];

const PERMISSIONS: { section: string; actions: { label: string; desc: string; patron: boolean; gestionnaire: boolean; caissier: boolean }[] }[] = [
  {
    section: 'Caisse',
    actions: [
      { label: 'Ouvrir une vente',          desc: 'Créer un nouveau ticket de caisse',          patron: true,  gestionnaire: false, caissier: true  },
      { label: 'Appliquer une remise',       desc: 'Modifier le prix d\'un article ou du total', patron: true,  gestionnaire: false, caissier: true  },
      { label: 'Annuler un ticket',          desc: 'Annuler une vente en cours',                 patron: true,  gestionnaire: false, caissier: true  },
      { label: 'Rembourser une vente',       desc: 'Émettre un remboursement',                   patron: true,  gestionnaire: false, caissier: false },
      { label: 'Accepter paiement mobile',   desc: 'Valider un paiement Mobile Money',           patron: true,  gestionnaire: false, caissier: true  },
    ],
  },
  {
    section: 'Stock',
    actions: [
      { label: 'Consulter le stock',         desc: 'Voir les niveaux de stock en temps réel',    patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Ajouter une réception',      desc: 'Enregistrer une livraison fournisseur',      patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Modifier un produit',        desc: 'Changer le prix, le nom, la catégorie',      patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Créer un produit',           desc: 'Ajouter un nouveau produit au catalogue',    patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Supprimer un produit',       desc: 'Retirer un produit du catalogue',            patron: true,  gestionnaire: false, caissier: false },
      { label: 'Gérer les fournisseurs',     desc: 'Ajouter / modifier les fournisseurs',        patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Faire un inventaire',        desc: 'Lancer et valider un inventaire complet',    patron: true,  gestionnaire: true,  caissier: false },
      { label: 'Imprimer des étiquettes',    desc: 'Générer et imprimer des étiquettes produits',patron: true,  gestionnaire: true,  caissier: false },
    ],
  },
  {
    section: 'Personnel',
    actions: [
      { label: 'Voir l\'équipe',             desc: 'Consulter la liste des collaborateurs',      patron: true,  gestionnaire: false, caissier: false },
      { label: 'Créer un caissier',          desc: 'Ajouter un nouveau compte caissier',         patron: true,  gestionnaire: false, caissier: false },
      { label: 'Créer un gestionnaire',      desc: 'Ajouter un nouveau compte gestionnaire',     patron: true,  gestionnaire: false, caissier: false },
      { label: 'Réinitialiser un PIN',       desc: 'Modifier le PIN d\'accès caisse',             patron: true,  gestionnaire: false, caissier: false },
      { label: 'Désactiver un compte',       desc: 'Bloquer l\'accès d\'un collaborateur',        patron: true,  gestionnaire: false, caissier: false },
    ],
  },
  {
    section: 'Rapports & Comptabilité',
    actions: [
      { label: 'Voir le tableau de bord',    desc: 'KPIs, chiffre d\'affaires, statistiques',    patron: true,  gestionnaire: false, caissier: false },
      { label: 'Consulter les rapports',     desc: 'Rapports mensuels et comparaisons',          patron: true,  gestionnaire: false, caissier: false },
      { label: 'Voir la comptabilité',       desc: 'Compte de résultat, TVA, charges',           patron: true,  gestionnaire: false, caissier: false },
      { label: 'Exporter les données',       desc: 'Export Excel / PDF des rapports',            patron: true,  gestionnaire: false, caissier: false },
      { label: 'Consulter l\'audit',         desc: 'Journal des actions sensibles',              patron: true,  gestionnaire: false, caissier: false },
    ],
  },
  {
    section: 'Système',
    actions: [
      { label: 'Modifier les paramètres',    desc: 'Infos magasin, TVA, devise, imprimantes',    patron: true,  gestionnaire: false, caissier: false },
      { label: 'Gérer les rôles',            desc: 'Modifier les permissions de chaque rôle',    patron: true,  gestionnaire: false, caissier: false },
      { label: 'Voir les dépôts',            desc: 'Consulter et gérer les dépôts de stockage',  patron: true,  gestionnaire: true,  caissier: false },
    ],
  },
];

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Patron:       { bg: 'var(--fs-wine-50)',    color: 'var(--fs-wine-700)',    border: 'rgba(122,29,46,0.2)'   },
  Gestionnaire: { bg: '#E8F0E5',              color: 'var(--fs-success-700)', border: 'rgba(90,139,83,0.2)'   },
  Caissier:     { bg: '#EEF3FA',              color: '#3A5E8F',               border: 'rgba(58,94,143,0.2)'   },
};

function Check({ on }: { on: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on
        ? <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#E8F0E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--fs-success-700)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--fs-ink-300)" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </div>
      }
    </div>
  );
}

export default function AdminRoles() {
  const [filter, setFilter] = useState<string | null>(null);

  const visible = filter
    ? PERMISSIONS.map(s => ({ ...s, actions: s.actions.filter(a => a[filter.toLowerCase() as keyof typeof a]) })).filter(s => s.actions.length > 0)
    : PERMISSIONS;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <AdminSidebar/>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--fs-ivory)' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Système</p>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>Rôles & Accès</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginRight: 4 }}>Filtrer par rôle :</span>
              {['Tous', ...ROLES].map(r => {
                const active = r === 'Tous' ? filter === null : filter === r.toLowerCase();
                const style = r !== 'Tous' && active ? ROLE_COLORS[r] : {};
                return (
                  <button key={r} onClick={() => setFilter(r === 'Tous' ? null : r.toLowerCase())}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: active ? `1.5px solid ${r !== 'Tous' ? ROLE_COLORS[r]?.border || 'var(--fs-wine-700)' : 'var(--fs-wine-700)'}` : '1.5px solid var(--fs-line)',
                      background: active ? (r !== 'Tous' ? ROLE_COLORS[r]?.bg || 'var(--fs-wine-50)' : 'var(--fs-wine-50)') : '#fff',
                      color: active ? (r !== 'Tous' ? ROLE_COLORS[r]?.color || 'var(--fs-wine-700)' : 'var(--fs-wine-700)') : 'var(--fs-ink-500)' }}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 18, padding: '10px 16px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10 }}>
            {ROLES.map(r => {
              const c = ROLE_COLORS[r];
              return (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${c.border}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{r}</span>
                  <span style={{ fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    {r === 'Patron' ? 'Accès total' : r === 'Gestionnaire' ? 'Stock uniquement' : 'Caisse uniquement'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--fs-ivory)' }}>
                  <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--fs-line)', width: '45%' }}>Action</th>
                  {ROLES.map(r => {
                    const c = ROLE_COLORS[r];
                    return (
                      <th key={r} style={{ padding: '10px 20px', textAlign: 'center', borderBottom: '1px solid var(--fs-line)', width: '18%' }}>
                        <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1px solid ${c.border}` }}>{r}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map(section => (
                  <React.Fragment key={section.section}>
                    <tr>
                      <td colSpan={4} style={{ padding: '10px 20px 6px', background: 'var(--fs-ivory)', borderTop: '2px solid var(--fs-line)', borderBottom: '1px solid var(--fs-line)' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{section.section}</span>
                      </td>
                    </tr>
                    {section.actions.map((action, i) => (
                      <tr key={action.label} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF9', borderBottom: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '11px 20px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink-800)' }}>{action.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 2 }}>{action.desc}</div>
                        </td>
                        <td style={{ padding: '11px 20px', textAlign: 'center' }}><Check on={action.patron}/></td>
                        <td style={{ padding: '11px 20px', textAlign: 'center' }}><Check on={action.gestionnaire}/></td>
                        <td style={{ padding: '11px 20px', textAlign: 'center' }}><Check on={action.caissier}/></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, padding: '10px 16px', background: 'var(--fs-wine-50)', border: '1px solid rgba(122,29,46,0.15)', borderRadius: 10, fontSize: 11, color: 'var(--fs-wine-700)', fontWeight: 600 }}>
            Ces permissions sont définies par le système. Contactez le support pour modifier les droits d'accès.
          </div>
        </div>
      </main>
    </div>
  );
}
