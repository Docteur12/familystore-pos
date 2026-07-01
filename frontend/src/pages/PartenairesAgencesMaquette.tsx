import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * MAQUETTE (données fictives, aucun appel serveur).
 * But : valider l'écran « dette par agence » + le tableau de bord avant de coder le back-end.
 *
 * Principe UNIFIÉ et flexible :
 *  - Chaque livraison et chaque versement garde l'agence concernée (ou « aucune »).
 *  - Chaque agence a un interrupteur « règle sa propre dette » (indépendante) ou « dette commune ».
 *      • Santa Lucia  = toutes les agences indépendantes.
 *      • Goutelot     = toutes en dette commune (avances libres).
 *      • Cas mixte    = une seule agence indépendante, les autres en commun.
 *  - On bascule une agence, on change le mode, on ajoute des agences à tout moment :
 *    l'historique est conservé, ce ne sont que deux façons de lire les mêmes données.
 */

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
  );
}
const D = {
  back:   'M19 12H5M12 19l-7-7 7-7',
  bank:   'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
  shop:   'M3 9l1-5h16l1 5M4 9v11h16V9M9 22v-6h6v6',
  user:   'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  plus:   'M12 5v14M5 12h14',
  cash:   'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  grid:   'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  link:   'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  unlink: 'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 8l8 8',
  edit:   'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  trash:  'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  undo:   'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  chart:  'M3 3v18h18M7 15l3-4 3 2 4-6',
  clock:  'M12 7v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  box:    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12l8.73-5.04M12 22V12',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--fs-font-sans)', background: '#fff',
};
const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-500)',
  textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4,
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '9px 18px', background: 'var(--fs-wine-700)', color: '#fff',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff',
  border: '1.5px solid var(--fs-line-2)', color: 'var(--fs-ink-700)', borderRadius: 9,
  padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const CARD: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, boxShadow: 'var(--fs-shadow-sm)',
};
const ICONBTN: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-500)', background: '#fff', border: '1.5px solid var(--fs-line-2)',
  borderRadius: 7, padding: '4px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6,
};

// ── Modèle ────────────────────────────────────────────────────────────────────
interface Agence { id: string; nom: string; ville: string; quartier?: string; telephone?: string; responsable?: string; commande: number; livre: number; independante: boolean; archivee?: boolean }
interface Versement { id: string; date: string; montant: number; agenceId: string | null; note?: string }
interface Part {
  id: string; nom: string; type: 'structure' | 'particulier'; tel: string;
  ville?: string; quartier?: string; responsable?: string; email?: string; note?: string;
  livreHorsAgence: number;   // livraisons non rattachées à une agence (cas particulier)
  agences: Agence[];
  versements: Versement[];
}

const A = (id: string, nom: string, ville: string, commande: number, livre: number, independante: boolean): Agence =>
  ({ id, nom, ville, commande, livre, independante });

const DATA0: Part[] = [
  {
    id: 'santa', nom: 'Santa Lucia', type: 'structure', tel: '690 00 00 01',
    ville: 'Douala', quartier: 'Akwa', responsable: 'M. Tatcheu', email: 'contact@santalucia.cm', livreHorsAgence: 0,
    agences: [
      A('s1', 'Agence Akwa',     'Douala',  320, 4_200_000, true),
      A('s2', 'Agence Bonabéri', 'Douala',  180, 2_500_000, true),
      A('s3', 'Agence Centre',   'Yaoundé', 240, 3_100_000, true),
      A('s4', 'Agence Molyko',   'Buea',    90,  1_400_000, true),
    ],
    versements: [
      { id: 'v1', date: '2026-06-10', montant: 3_000_000, agenceId: 's1' },
      { id: 'v2', date: '2026-06-12', montant: 2_500_000, agenceId: 's2' },
      { id: 'v3', date: '2026-06-18', montant: 1_200_000, agenceId: 's3' },
      { id: 'v4', date: '2026-06-20', montant: 400_000,   agenceId: 's4' },
    ],
  },
  {
    id: 'goute', nom: 'Goutelot', type: 'structure', tel: '691 22 33 44',
    ville: 'Douala', quartier: 'Bonanjo', responsable: 'Mme Ngo', livreHorsAgence: 0,
    agences: [
      A('g1', 'Agence Douala',    'Douala',    200, 2_800_000, false),
      A('g2', 'Agence Yaoundé',   'Yaoundé',   150, 1_900_000, false),
      A('g3', 'Agence Bafoussam', 'Bafoussam', 80,  1_100_000, false),
      A('g4', 'Agence Buea',      'Buea',      60,  900_000,   false),
    ],
    versements: [
      { id: 'v5', date: '2026-06-08', montant: 2_000_000, agenceId: null, note: 'Avance' },
      { id: 'v6', date: '2026-06-15', montant: 200_000,   agenceId: null, note: 'Acompte' },
      { id: 'v7', date: '2026-06-21', montant: 500_000,   agenceId: null, note: 'Avance' },
    ],
  },
  {
    id: 'rebec', nom: 'Rebecca', type: 'structure', tel: '697 88 11 22',
    ville: 'Douala', quartier: 'Bali', responsable: 'M. Eyenga', livreHorsAgence: 0,
    agences: Array.from({ length: 8 }, (_, i) =>
      A(`r${i + 1}`, `Agence ${i + 1}`, ['Douala', 'Yaoundé', 'Buea', 'Bafoussam', 'Limbe', 'Kribi', 'Edéa', 'Bamenda'][i],
        50 + i * 20, 600_000 + i * 250_000, false)),
    versements: [
      { id: 'v8', date: '2026-06-05', montant: 2_000_000, agenceId: null, note: 'Avance' },
      { id: 'v9', date: '2026-06-19', montant: 100_000,   agenceId: null, note: 'Acompte' },
    ],
  },
  {
    id: 'mng', nom: 'Maman Ngo', type: 'particulier', tel: '655 44 33 22',
    ville: 'Douala', quartier: 'Bonabéri', responsable: 'Maman Ngo', livreHorsAgence: 500_000, agences: [],
    versements: [{ id: 'v10', date: '2026-06-17', montant: 150_000, agenceId: null, note: 'Espèces' }],
  },
  {
    // Présentoir = partenaire ordinaire. Livré = marchandises sorties du magasin ;
    // Versé = recette ramenée ; « dette » = stock encore au présentoir non encaissé.
    id: 'presentoir', nom: 'Présentoir Mabanda', type: 'particulier', tel: '—',
    ville: 'Douala', quartier: 'Bonabéri', responsable: 'Point de vente interne', livreHorsAgence: 1_200_000, agences: [],
    versements: [{ id: 'vp1', date: '2026-06-21', montant: 800_000, agenceId: null, note: 'Recette présentoir' }],
  },
];

// ── Calculs (un seul jeu de formules) ──────────────────────────────────────────
const verseAgence  = (p: Part, a: Agence) => p.versements.filter(v => v.agenceId === a.id).reduce((s, v) => s + v.montant, 0);
const soldeAgence  = (p: Part, a: Agence) => Math.max(0, a.livre - verseAgence(p, a));
const indepAgences = (p: Part) => p.agences.filter(a => a.independante);
const poolAgences  = (p: Part) => p.agences.filter(a => !a.independante);
// dette commune = livré hors-agence + agences en commun − versements communs (null ou ciblant une agence en commun)
const versementsCommuns = (p: Part) => p.versements.filter(v => {
  if (!v.agenceId) return true;
  const a = p.agences.find(x => x.id === v.agenceId);
  return a ? !a.independante : true;
});
const livreCommun  = (p: Part) => p.livreHorsAgence + poolAgences(p).reduce((s, a) => s + a.livre, 0);
const verseCommun  = (p: Part) => versementsCommuns(p).reduce((s, v) => s + v.montant, 0);
const detteCommune = (p: Part) => Math.max(0, livreCommun(p) - verseCommun(p));
const totalLivre   = (p: Part) => p.livreHorsAgence + p.agences.reduce((s, a) => s + a.livre, 0);
const detteTotale  = (p: Part) => indepAgences(p).reduce((s, a) => s + soldeAgence(p, a), 0) + detteCommune(p);

// lignes de créance pour le tableau de bord (agences indépendantes + pools + particuliers)
function debiteurs(data: Part[]) {
  const lignes: { label: string; sub: string; solde: number }[] = [];
  for (const p of data) {
    for (const a of indepAgences(p)) lignes.push({ label: p.nom, sub: `${a.nom} · ${a.ville}`, solde: soldeAgence(p, a) });
    const dc = detteCommune(p);
    if (dc > 0) lignes.push({ label: p.nom, sub: indepAgences(p).length ? 'Dette commune (autres agences)' : (p.agences.length ? 'Dette commune' : 'Particulier'), solde: dc });
  }
  return lignes.filter(l => l.solde > 0).sort((x, y) => y.solde - x.solde);
}

// ── Livraisons détaillées (produits, quantités, dates) — pour le tableau de bord ──
interface LivLigne { produit: string; quantite: number; prix: number }
interface Liv { id: string; partenaireId: string; agenceId: string | null; date: string; lignes: LivLigne[] }

const LIVRAISONS0: Liv[] = [
  { id: 'L1', partenaireId: 'santa', agenceId: 's1', date: '2026-06-09', lignes: [{ produit: 'Savon Lux 175g', quantite: 120, prix: 350 }, { produit: 'Huile Mayor 1L', quantite: 80, prix: 1500 }] },
  { id: 'L2', partenaireId: 'santa', agenceId: 's3', date: '2026-06-17', lignes: [{ produit: 'Lait Nido 400g', quantite: 60, prix: 2800 }, { produit: 'Dentifrice Signal 100ml', quantite: 100, prix: 600 }] },
  { id: 'L3', partenaireId: 'goute', agenceId: 'g1', date: '2026-06-07', lignes: [{ produit: 'Eau de Javel 1L', quantite: 200, prix: 500 }, { produit: 'Sucre en poudre 1kg', quantite: 90, prix: 900 }] },
  { id: 'L4', partenaireId: 'goute', agenceId: 'g2', date: '2026-06-14', lignes: [{ produit: 'Riz parfumé 5kg', quantite: 40, prix: 4500 }] },
  { id: 'L5', partenaireId: 'rebec', agenceId: 'r1', date: '2026-06-05', lignes: [{ produit: 'Pommade Nivea 200ml', quantite: 70, prix: 2500 }] },
  { id: 'L6', partenaireId: 'rebec', agenceId: 'r3', date: '2026-06-18', lignes: [{ produit: 'Savon Lux 175g', quantite: 150, prix: 350 }, { produit: 'Huile Mayor 1L', quantite: 60, prix: 1500 }] },
  { id: 'L7', partenaireId: 'mng',   agenceId: null, date: '2026-06-16', lignes: [{ produit: 'Dentifrice Signal 100ml', quantite: 50, prix: 600 }, { produit: 'Lait Nido 400g', quantite: 30, prix: 2800 }] },
];

const livTotal = (l: Liv) => l.lignes.reduce((s, x) => s + x.quantite * x.prix, 0);
const livQte   = (l: Liv) => l.lignes.reduce((s, x) => s + x.quantite, 0);
const fmtJour  = (d: string) => { try { return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

export default function PartenairesAgencesMaquette() {
  const navigate = useNavigate();
  const [data, setData] = useState<Part[]>(DATA0);
  const [view, setView] = useState<'detail' | 'dashboard' | 'apport' | 'historique'>('detail');
  const [selId, setSelId] = useState('goute');
  const sel = data.find(p => p.id === selId)!;

  // Libellé « Partenaire · Agence » pour une livraison/opération
  const agenceLabel = (partenaireId: string, agenceId: string | null) => {
    const p = data.find(x => x.id === partenaireId);
    const a = agenceId ? p?.agences.find(x => x.id === agenceId) : null;
    return { partenaire: p?.nom ?? '—', agence: a ? `${a.nom}${a.ville ? ' · ' + a.ville : ''}` : (p?.agences.length ? 'Sans agence' : '—') };
  };

  const [vAgence, setVAgence] = useState<string>('');
  const [vMontant, setVMontant] = useState('');

  const patch = (fn: (p: Part) => Part) => setData(prev => prev.map(p => p.id === selId ? fn(p) : p));

  const enregistrerVersement = (agenceId: string | null) => {
    const montant = parseInt(vMontant) || 0;
    if (montant <= 0) return;
    patch(p => ({ ...p, versements: [{ id: `n${Math.round(montant)}-${p.versements.length}`, date: '2026-06-24', montant, agenceId, note: agenceId ? undefined : 'Avance' }, ...p.versements] }));
    setVMontant(''); setVAgence('');
  };

  const toggleAgence = (id: string) => patch(p => ({ ...p, agences: p.agences.map(a => a.id === id ? { ...a, independante: !a.independante } : a) }));
  const setToutes = (independante: boolean) => patch(p => ({ ...p, agences: p.agences.map(a => ({ ...a, independante })) }));

  // Créer / modifier une AGENCE (vraie fiche : nom, ville, zone/quartier, coordonnées)
  type AForm = { id: string | null; nom: string; ville: string; quartier: string; telephone: string; responsable: string; independante: boolean };
  const [aEdit, setAEdit] = useState<null | AForm>(null);
  const ouvrirNouvelleAgence = () => setAEdit({ id: null, nom: '', ville: sel.ville ?? '', quartier: '', telephone: '', responsable: '', independante: false });
  const ouvrirEditAgence = (a: Agence) => setAEdit({ id: a.id, nom: a.nom, ville: a.ville ?? '', quartier: a.quartier ?? '', telephone: a.telephone ?? '', responsable: a.responsable ?? '', independante: a.independante });
  const saveAgence = () => {
    if (!aEdit) return;
    const nom = aEdit.nom.trim(); if (!nom) return;
    const champs = { nom, ville: aEdit.ville.trim(), quartier: aEdit.quartier.trim(), telephone: aEdit.telephone.trim(), responsable: aEdit.responsable.trim(), independante: aEdit.independante };
    if (aEdit.id) {
      patch(p => ({ ...p, agences: p.agences.map(a => a.id === aEdit.id ? { ...a, ...champs } : a) }));
    } else {
      patch(p => ({ ...p, agences: [...p.agences, { id: `${p.id}-x${p.agences.length + 1}`, ...champs, commande: 0, livre: 0 }] }));
    }
    setAEdit(null);
  };
  const reactiver = (id: string) => patch(p => ({ ...p, agences: p.agences.map(a => a.id === id ? { ...a, archivee: false } : a) }));
  const deleteAgence = (a: Agence) => {
    const hasHistory = a.livre > 0 || a.commande > 0 || sel.versements.some(v => v.agenceId === a.id);
    if (!hasHistory) { patch(p => ({ ...p, agences: p.agences.filter(x => x.id !== a.id) })); return; }
    if (a.archivee) {
      if (window.confirm(`Supprimer DÉFINITIVEMENT « ${a.nom} » et tout son historique ? Action irréversible.`))
        patch(p => ({ ...p, agences: p.agences.filter(x => x.id !== a.id), versements: p.versements.filter(v => v.agenceId !== a.id) }));
    } else {
      if (window.confirm(`« ${a.nom} » a un historique (commandes / livraisons / versements). Pour ne pas fausser la comptabilité, elle sera ARCHIVÉE : conservée dans les totaux et l'historique, mais retirée des nouvelles opérations.\n\nArchiver maintenant ?`))
        patch(p => ({ ...p, agences: p.agences.map(x => x.id === a.id ? { ...x, archivee: true } : x) }));
    }
  };

  // Créer / modifier / supprimer un PARTENAIRE
  type PForm = { id: string | null; nom: string; type: 'structure' | 'particulier'; tel: string; ville: string; quartier: string; responsable: string; email: string; note: string };
  const [pEdit, setPEdit] = useState<null | PForm>(null);
  const PFORM_VIDE: PForm = { id: null, nom: '', type: 'structure', tel: '', ville: '', quartier: '', responsable: '', email: '', note: '' };
  const ouvrirNouveauPartenaire = () => setPEdit({ ...PFORM_VIDE });
  const ouvrirEditPartenaire = (p: Part) => setPEdit({ id: p.id, nom: p.nom, type: p.type, tel: p.tel, ville: p.ville ?? '', quartier: p.quartier ?? '', responsable: p.responsable ?? '', email: p.email ?? '', note: p.note ?? '' });
  const savePartenaire = () => {
    if (!pEdit) return;
    const nom = pEdit.nom.trim(); if (!nom) return;
    const champs = {
      nom, type: pEdit.type, tel: pEdit.tel.trim(),
      ville: pEdit.ville.trim(), quartier: pEdit.quartier.trim(),
      responsable: pEdit.responsable.trim(), email: pEdit.email.trim(), note: pEdit.note.trim(),
    };
    if (pEdit.id) {
      setData(prev => prev.map(p => p.id === pEdit.id ? { ...p, ...champs } : p));
    } else {
      const id = `p${Math.round(nom.length)}-${data.length}`;
      setData(prev => [...prev, { id, ...champs, livreHorsAgence: 0, agences: [], versements: [] }]);
      setSelId(id); setView('detail');
    }
    setPEdit(null);
  };
  const deletePartenaire = (p: Part) => {
    const hasHistory = totalLivre(p) > 0 || p.versements.length > 0;
    if (hasHistory) { window.alert(`« ${p.nom} » a un historique (livraisons / versements). Pour ne pas fausser la comptabilité, on n'efface pas un partenaire avec mouvements.\n\nDans la vraie application il sera « archivé » (masqué des nouvelles opérations, conservé dans l'historique).`); return; }
    if (window.confirm(`Supprimer « ${p.nom} » ? (aucun historique)`)) {
      setData(prev => prev.filter(x => x.id !== p.id));
      if (selId === p.id) { setView('dashboard'); }
    }
  };

  const indeps = indepAgences(sel);
  const pools = poolAgences(sel);
  const stat = useMemo(() => ({ livre: totalLivre(sel), dette: detteTotale(sel), commune: detteCommune(sel) }), [sel]);
  const dashDebiteurs = useMemo(() => debiteurs(data), [data]);
  const creancesTotales = dashDebiteurs.reduce((s, l) => s + l.solde, 0);
  const nbAgences = data.reduce((s, p) => s + p.agences.length, 0);

  const goDetail = (id: string) => { setSelId(id); setView('detail'); setVAgence(''); };

  const NAV = [
    { key: 'dashboard', label: 'Tableau de bord', icon: D.grid },
    { key: 'apport', label: 'Rapport & analyse', icon: D.chart },
    { key: 'historique', label: 'Historique', icon: D.clock },
  ] as { key: 'dashboard' | 'apport' | 'historique'; label: string; icon: string }[];
  const titreVue = view === 'dashboard' ? 'Tableau de bord' : view === 'apport' ? 'Rapport & analyse' : view === 'historique' ? 'Historique' : sel.nom;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)', background: 'var(--fs-ivory)' }}>

      {/* Sidebar FamilyStore */}
      <aside style={{ width: 210, background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 4 }}>Family Store</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Partenaires</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
          {NAV.map(t => {
            const a = view === t.key;
            return (
              <button key={t.key} onClick={() => setView(t.key)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 2,
                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: 'var(--fs-font-sans)',
                background: a ? 'var(--fs-wine-700)' : 'transparent',
                borderLeft: a ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
                color: a ? '#fff' : 'rgba(245,235,217,0.65)', fontWeight: a ? 600 : 400,
              }}>
                <span style={{ color: a ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)' }}><I d={t.icon} size={15}/></span>
                {t.label}
              </button>
            );
          })}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 10px 6px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Partenaires</span>
            <button onClick={ouvrirNouveauPartenaire} title="Nouveau partenaire" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.08)', color: 'var(--fs-gold-300)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><I d={D.plus} size={11}/> Nouveau</button>
          </div>
          {data.map(p => {
            const active = p.id === selId && view === 'detail';
            const solde = detteTotale(p);
            const nbIndep = indepAgences(p).length;
            return (
              <button key={p.id} onClick={() => goDetail(p.id)} style={{
                width: '100%', textAlign: 'left', marginBottom: 3, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: 'none',
                background: active ? 'var(--fs-wine-700)' : 'rgba(255,255,255,0.03)',
                borderLeft: active ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: 'var(--fs-gold-400)' }}><I d={p.type === 'particulier' ? D.user : D.bank} size={14}/></span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{p.nom}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {p.agences.length > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(96,165,250,0.22)', color: '#bfdbfe' }}>{nbIndep}/{p.agences.length} indép.</span>}
                  {p.agences.length === 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(74,222,128,0.18)', color: '#bbf7d0' }}>Sans agence</span>}
                </div>
                <div style={{ fontSize: 10.5, color: solde > 0 ? '#fca5a5' : '#86efac', fontWeight: 700, fontFamily: 'var(--fs-font-mono)', marginTop: 3 }}>Dette : {fmtN(solde)} XAF</div>
              </button>
            );
          })}

          <div style={{ margin: '10px 6px 0', padding: '9px 10px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--fs-gold-400)' }}><I d={D.shop} size={13}/></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,235,217,0.85)' }}>Présentoir</span>
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(245,235,217,0.5)', marginTop: 3 }}>Géré comme un partenaire (« Présentoir Mabanda » ci-dessus) : livré = sorti du magasin, versé = recette.</div>
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => navigate(-1)} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--fs-gold-300)', cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}><I d={D.back} size={13}/> Retour</button>
        </div>
      </aside>

      {/* Zone principale */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '12px 28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Espace Partenaires</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, fontFamily: 'var(--fs-font-display)' }}>{titreVue}</h1>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a16207', background: '#fef9e7', border: '1px solid #f0d98a', borderRadius: 8, padding: '4px 10px', whiteSpace: 'nowrap' }}>● Maquette — données fictives</span>
        </div>

        {/* ════════════ TABLEAU DE BORD ════════════ */}
        {view === 'dashboard' && (
          <main style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
            <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: '0 0 16px' }}>Vue d'ensemble. Les agences indépendantes apparaissent comme des débiteurs distincts.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              {[
                { label: 'Créances totales', val: `${fmtN(creancesTotales)} XAF`, color: 'var(--fs-danger-700)' },
                { label: 'Total livré', val: `${fmtN(data.reduce((s, p) => s + totalLivre(p), 0))} XAF`, color: 'var(--fs-ink-900)' },
                { label: 'Partenaires', val: `${data.length}`, color: 'var(--fs-wine-700)' },
                { label: 'Agences', val: `${nbAgences}`, color: 'var(--fs-wine-700)' },
              ].map(m => (
                <div key={m.label} style={{ ...CARD, flex: '1 1 170px', padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{m.val}</div>
                </div>
              ))}
            </div>

            <div style={{ ...CARD, padding: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Top débiteurs (créances)</p>
              {dashDebiteurs.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune créance — tout est réglé ✓</div>
              ) : dashDebiteurs.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--fs-line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-500)', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{l.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{l.sub}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-danger-700)', flexShrink: 0 }}>{fmtN(l.solde)}</span>
                </div>
              ))}
            </div>

            {/* Dernières livraisons (produits, quantités, date) */}
            <div style={{ ...CARD, padding: 18, marginTop: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Dernières livraisons</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '6px 8px' }}>Date</th>
                      <th style={{ padding: '6px 8px' }}>Partenaire · Agence</th>
                      <th style={{ padding: '6px 8px' }}>Produits livrés</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...LIVRAISONS0].sort((a, b) => b.date.localeCompare(a.date)).map(l => {
                      const lab = agenceLabel(l.partenaireId, l.agenceId);
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid var(--fs-line)', verticalAlign: 'top' }}>
                          <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{fmtJour(l.date)}</td>
                          <td style={{ padding: '9px 8px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{lab.partenaire}</div>
                            <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{lab.agence}</div>
                          </td>
                          <td style={{ padding: '9px 8px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {l.lignes.map((lg, i) => (
                                <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '2px 8px', color: 'var(--fs-ink-700)' }}>{lg.produit} × <strong>{lg.quantite}</strong></span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700 }}>{fmtN(livTotal(l))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ════════════ APPORT & ANALYSE ════════════ */}
        {view === 'apport' && (() => {
          const lignesProd = new Map<string, { quantite: number; montant: number }>();
          for (const l of LIVRAISONS0) for (const lg of l.lignes) {
            const e = lignesProd.get(lg.produit) ?? { quantite: 0, montant: 0 };
            e.quantite += lg.quantite; e.montant += lg.quantite * lg.prix;
            lignesProd.set(lg.produit, e);
          }
          const topProduits = [...lignesProd.entries()].map(([produit, v]) => ({ produit, ...v })).sort((a, b) => b.montant - a.montant);
          const caTotal = data.reduce((s, p) => s + totalLivre(p), 0) || 1;
          const apports = data.map(p => ({ nom: p.nom, livre: totalLivre(p), encaisse: p.versements.reduce((s, v) => s + v.montant, 0), dette: detteTotale(p), part: totalLivre(p) / caTotal })).sort((a, b) => b.livre - a.livre);
          const topDebiteur = dashDebiteurs[0];
          return (
            <main style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: '0 0 16px' }}>Contribution de chaque partenaire au chiffre, et produits les plus livrés.</p>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 18 }}>
                {topDebiteur
                  ? <>📊 Plus gros débiteur : <strong>{topDebiteur.label}</strong> ({topDebiteur.sub}) avec <strong>{fmtN(topDebiteur.solde)} XAF</strong> dus, soit {Math.round(topDebiteur.solde / (creancesTotales || 1) * 100)} % des créances.</>
                  : '✓ Aucune créance en cours.'}
              </div>

              {/* Contribution par partenaire */}
              <div style={{ ...CARD, padding: 18, marginBottom: 18 }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Contribution par partenaire</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '6px 8px' }}>Partenaire</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total livré</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Encaissé</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reste dû</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Part du chiffre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apports.map(a => (
                      <tr key={a.nom} style={{ borderTop: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '9px 8px', fontWeight: 700, color: 'var(--fs-ink-900)' }}>{a.nom}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.livre)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(a.encaisse)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: a.dette > 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>{fmtN(a.dette)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <div style={{ width: 70, height: 6, background: 'var(--fs-line)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.round(a.part * 100)}%`, height: '100%', background: 'var(--fs-wine-700)' }}/>
                            </div>
                            <span style={{ fontFamily: 'var(--fs-font-mono)', fontSize: 12 }}>{Math.round(a.part * 100)} %</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top produits livrés */}
              <div style={{ ...CARD, padding: 18 }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Produits les plus livrés</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '6px 8px' }}>Produit</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantité totale</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProduits.map(p => (
                      <tr key={p.produit} style={{ borderTop: '1px solid var(--fs-line)' }}>
                        <td style={{ padding: '9px 8px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.produit}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(p.quantite)}</td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(p.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </main>
          );
        })()}

        {/* ════════════ HISTORIQUE ════════════ */}
        {view === 'historique' && (() => {
          type Op = { date: string; partenaireId: string; agenceId: string | null; type: 'Livraison' | 'Versement'; detail: React.ReactNode; montant: number };
          const ops: Op[] = [];
          for (const l of LIVRAISONS0) ops.push({
            date: l.date, partenaireId: l.partenaireId, agenceId: l.agenceId, type: 'Livraison', montant: livTotal(l),
            detail: <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{l.lignes.map((lg, i) => <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '2px 8px', color: 'var(--fs-ink-700)' }}>{lg.produit} × <strong>{lg.quantite}</strong></span>)}</div>,
          });
          for (const p of data) for (const v of p.versements) ops.push({
            date: v.date, partenaireId: p.id, agenceId: v.agenceId, type: 'Versement', montant: v.montant,
            detail: <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>{v.note ?? 'Versement'}</span>,
          });
          ops.sort((a, b) => b.date.localeCompare(a.date));
          return (
            <main style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: '0 0 16px' }}>Toutes les opérations (livraisons & versements), du plus récent au plus ancien.</p>
              <div style={{ ...CARD, padding: 18 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '6px 8px' }}>Date</th>
                        <th style={{ padding: '6px 8px' }}>Partenaire · Agence</th>
                        <th style={{ padding: '6px 8px' }}>Opération</th>
                        <th style={{ padding: '6px 8px' }}>Détail</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.map((o, i) => {
                        const lab = agenceLabel(o.partenaireId, o.agenceId);
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--fs-line)', verticalAlign: 'top' }}>
                            <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{fmtJour(o.date)}</td>
                            <td style={{ padding: '9px 8px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{lab.partenaire}</div>
                              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{lab.agence}</div>
                            </td>
                            <td style={{ padding: '9px 8px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: o.type === 'Livraison' ? '#eff6ff' : '#f0fdf4', color: o.type === 'Livraison' ? '#2563eb' : '#16a34a' }}>{o.type}</span>
                            </td>
                            <td style={{ padding: '9px 8px' }}>{o.detail}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: o.type === 'Versement' ? 'var(--fs-success-700)' : 'var(--fs-ink-900)' }}>{fmtN(o.montant)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </main>
          );
        })()}

        {/* ════════════ DÉTAIL PARTENAIRE ════════════ */}
        {view === 'detail' && (
          <main style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{sel.nom}</h1>
                <div style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>
                  {sel.type === 'particulier' ? 'Particulier (revendeur)' : 'Structure'}
                  {[sel.ville, sel.quartier].filter(Boolean).length > 0 && ` · ${[sel.ville, sel.quartier].filter(Boolean).join(' ')}`}
                  {sel.tel && ` · ${sel.tel}`}
                  {sel.responsable && ` · ${sel.responsable}`}
                  {sel.agences.length > 0 && ` · ${indeps.length} agence(s) indépendante(s) / ${sel.agences.length}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => ouvrirEditPartenaire(sel)} style={BTN_GHOST}><I d={D.edit} size={14}/> Modifier</button>
                <button onClick={() => deletePartenaire(sel)} style={{ ...BTN_GHOST, color: 'var(--fs-danger-700)', borderColor: 'rgba(194,62,36,0.3)' }}><I d={D.trash} size={14}/> Supprimer</button>
                <button onClick={ouvrirNouvelleAgence} style={BTN_GHOST}><I d={D.plus} size={14}/> Ajouter une agence</button>
                {sel.agences.length > 0 && <>
                  <button onClick={() => setToutes(true)} style={BTN_GHOST}><I d={D.unlink} size={14}/> Toutes indépendantes</button>
                  <button onClick={() => setToutes(false)} style={BTN_GHOST}><I d={D.link} size={14}/> Toutes en commun</button>
                </>}
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16 }}>
              <strong>Astuce :</strong> dans les tableaux, le bouton 🔗/⛓ rend <strong>une seule</strong> agence indépendante (elle règle sa propre dette)
              ou la remet dans la dette commune. C'est ainsi qu'une agence de Goutelot peut être autonome pendant que les autres restent groupées.
            </div>

            {/* Totaux */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              {[
                { label: 'Total livré', val: stat.livre, color: 'var(--fs-ink-900)' },
                { label: 'Dette commune', val: stat.commune, color: 'var(--fs-ink-700)' },
                { label: 'Dette totale', val: stat.dette, color: 'var(--fs-danger-700)' },
              ].map(m => (
                <div key={m.label} style={{ ...CARD, flex: '1 1 170px', padding: '14px 18px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{fmtN(m.val)} <span style={{ fontSize: 12 }}>XAF</span></div>
                </div>
              ))}
            </div>

            {/* Agences indépendantes */}
            {indeps.length > 0 && (
              <div style={{ ...CARD, padding: 18, marginBottom: 18 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Agences indépendantes <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>— règlent leur propre dette</span></p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ padding: '6px 8px' }}>Agence</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qté cmd.</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Livré</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Versé</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Solde dû</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indeps.map(a => {
                        const s = soldeAgence(sel, a);
                        return (
                          <tr key={a.id} style={{ borderTop: '1px solid var(--fs-line)' }}>
                            <td style={{ padding: '9px 8px' }}>
                              <div style={{ fontWeight: 700, color: a.archivee ? 'var(--fs-ink-400)' : 'var(--fs-ink-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {a.nom}
                                {a.archivee && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280' }}>Archivée</span>}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{[a.ville, a.quartier].filter(Boolean).join(' · ') || '—'}</div>
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.commande)}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.livre)}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(verseAgence(sel, a))}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: s > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(s)}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button onClick={() => setVAgence(a.id)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-wine-700)', background: '#fff', border: '1.5px solid var(--fs-wine-700)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>Verser</button>
                              {a.archivee
                                ? <button onClick={() => reactiver(a.id)} title="Réactiver" style={ICONBTN}><I d={D.undo} size={12}/></button>
                                : <button onClick={() => toggleAgence(a.id)} title="Remettre dans la dette commune" style={ICONBTN}><I d={D.link} size={12}/></button>}
                              <button onClick={() => ouvrirEditAgence(a)} title="Modifier" style={ICONBTN}><I d={D.edit} size={12}/></button>
                              <button onClick={() => deleteAgence(a)} title="Archiver / supprimer" style={{ ...ICONBTN, color: 'var(--fs-danger-500)', borderColor: 'rgba(194,62,36,0.3)' }}><I d={D.trash} size={12}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Versement sur agence indépendante */}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--fs-line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <div style={{ width: 220 }}>
                    <label style={LABEL}>Agence à régler</label>
                    <select value={vAgence} onChange={e => setVAgence(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="">— Choisir —</option>
                      {indeps.map(a => <option key={a.id} value={a.id}>{a.nom} · {a.ville}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 160 }}>
                    <label style={LABEL}>Montant versé</label>
                    <input type="number" min={0} value={vMontant} onChange={e => setVMontant(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                  </div>
                  <button onClick={() => vAgence && enregistrerVersement(vAgence)} style={{ ...BTN_PRIMARY, opacity: vAgence ? 1 : 0.5 }}><I d={D.cash} size={13}/> Enregistrer</button>
                </div>
              </div>
            )}

            {/* Dette commune (pool + hors-agence) */}
            {(pools.length > 0 || sel.livreHorsAgence > 0 || sel.agences.length === 0) && (
              <div style={{ ...CARD, padding: 18, marginBottom: 18 }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Dette commune <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>— avances libres</span></p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Versements de montants au choix (200 000, 2 M…) qui réduisent la dette commune, sans rapport avec une facture.</p>

                {pools.length > 0 && (
                  <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <th style={{ padding: '6px 8px' }}>Agence (suivi)</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qté cmd.</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Livré</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pools.map(a => (
                          <tr key={a.id} style={{ borderTop: '1px solid var(--fs-line)' }}>
                            <td style={{ padding: '9px 8px' }}>
                              <div style={{ fontWeight: 700, color: a.archivee ? 'var(--fs-ink-400)' : 'var(--fs-ink-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {a.nom}
                                {a.archivee && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280' }}>Archivée</span>}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{[a.ville, a.quartier].filter(Boolean).join(' · ') || '—'}</div>
                            </td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.commande)}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.livre)}</td>
                            <td style={{ padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button onClick={() => toggleAgence(a.id)} title="Rendre cette agence indépendante" style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><I d={D.unlink} size={12}/> Indép.</button>
                              <button onClick={() => ouvrirEditAgence(a)} title="Modifier" style={ICONBTN}><I d={D.edit} size={12}/></button>
                              <button onClick={() => deleteAgence(a)} title="Archiver / supprimer" style={{ ...ICONBTN, color: 'var(--fs-danger-500)', borderColor: 'rgba(194,62,36,0.3)' }}><I d={D.trash} size={12}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
                  <div style={{ width: 180 }}>
                    <label style={LABEL}>Montant de l'avance</label>
                    <input type="number" min={0} value={vMontant} onChange={e => setVMontant(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                  </div>
                  <button onClick={() => enregistrerVersement(null)} style={BTN_PRIMARY}><I d={D.cash} size={13}/> Enregistrer le versement</button>
                  <div style={{ flex: 1, minWidth: 160, textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dette commune restante</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: stat.commune > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(stat.commune)} XAF</div>
                  </div>
                </div>

                {/* Historique versements communs */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '6px 8px' }}>Date</th>
                      <th style={{ padding: '6px 8px' }}>Opération</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Versé</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Dette restante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const tot = livreCommun(sel);
                      let cumulApres = verseCommun(sel);
                      const liste = versementsCommuns(sel);
                      if (liste.length === 0) return <tr><td colSpan={4} style={{ padding: '10px 8px', color: 'var(--fs-ink-300)' }}>Aucun versement commun</td></tr>;
                      return liste.map(v => {
                        const detteApres = Math.max(0, tot - cumulApres);
                        cumulApres -= v.montant;
                        return (
                          <tr key={v.id} style={{ borderTop: '1px solid var(--fs-line)' }}>
                            <td style={{ padding: '8px' }}>{v.date}</td>
                            <td style={{ padding: '8px', color: 'var(--fs-ink-500)' }}>Versement{v.note ? ` — ${v.note}` : ''}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(v.montant)}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-ink-700)' }}>{fmtN(detteApres)}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        )}
      </div>

      {/* Modal agence — fiche */}
      {aEdit && (
        <div onClick={() => setAEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{aEdit.id ? "Modifier l'agence" : 'Nouvelle agence'}</p>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Agence de <strong>{sel.nom}</strong>.</p>

            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>Nom de l'agence *</label>
              <input value={aEdit.nom} onChange={e => setAEdit({ ...aEdit, nom: e.target.value })} placeholder="Ex. Agence Akwa" style={INPUT} autoFocus/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={LABEL}>Ville</label>
                <input value={aEdit.ville} onChange={e => setAEdit({ ...aEdit, ville: e.target.value })} placeholder="Ex. Douala" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Zone / quartier</label>
                <input value={aEdit.quartier} onChange={e => setAEdit({ ...aEdit, quartier: e.target.value })} placeholder="Ex. Akwa, Bonabéri…" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Téléphone</label>
                <input value={aEdit.telephone} onChange={e => setAEdit({ ...aEdit, telephone: e.target.value })} placeholder="6XX XX XX XX" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Responsable</label>
                <input value={aEdit.responsable} onChange={e => setAEdit({ ...aEdit, responsable: e.target.value })} placeholder="Nom du responsable" style={INPUT}/>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--fs-line-2)', marginBottom: 18 }}>
              <input type="checkbox" checked={aEdit.independante} onChange={e => setAEdit({ ...aEdit, independante: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }}/>
              <span style={{ fontSize: 13, color: 'var(--fs-ink-700)' }}><strong>Règle sa propre dette</strong> (indépendante) — sinon elle entre dans la dette commune du partenaire.</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAEdit(null)} style={BTN_GHOST}>Annuler</button>
              <button onClick={saveAgence} style={{ ...BTN_PRIMARY, opacity: aEdit.nom.trim() ? 1 : 0.5 }}>{aEdit.id ? 'Enregistrer' : "Ajouter l'agence"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal partenaire — fiche d'inscription */}
      {pEdit && (
        <div onClick={() => setPEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{pEdit.id ? 'Modifier le partenaire' : "Fiche d'inscription — nouveau partenaire"}</p>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Renseignez l'identité et la localisation. Les <strong>agences s'ajoutent ensuite</strong> sur la fiche du partenaire.</p>

            {/* Identité */}
            <p style={{ ...LABEL, marginBottom: 8, color: 'var(--fs-wine-700)' }}>Identité</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ gridColumn: '1 / 3' }}>
                <label style={LABEL}>Nom / raison sociale *</label>
                <input value={pEdit.nom} onChange={e => setPEdit({ ...pEdit, nom: e.target.value })} placeholder="Ex. Santa Lucia" style={INPUT} autoFocus/>
              </div>
              <div>
                <label style={LABEL}>Type de partenaire</label>
                <select value={pEdit.type} onChange={e => setPEdit({ ...pEdit, type: e.target.value as 'structure' | 'particulier' })} style={{ ...INPUT, cursor: 'pointer' }}>
                  <option value="structure">Structure (entreprise)</option>
                  <option value="particulier">Particulier (revendeur)</option>
                </select>
              </div>
              <div>
                <label style={LABEL}>Responsable / contact</label>
                <input value={pEdit.responsable} onChange={e => setPEdit({ ...pEdit, responsable: e.target.value })} placeholder="Nom du responsable" style={INPUT}/>
              </div>
            </div>

            {/* Coordonnées */}
            <p style={{ ...LABEL, marginBottom: 8, color: 'var(--fs-wine-700)' }}>Coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={LABEL}>Téléphone</label>
                <input value={pEdit.tel} onChange={e => setPEdit({ ...pEdit, tel: e.target.value })} placeholder="6XX XX XX XX" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Email</label>
                <input value={pEdit.email} onChange={e => setPEdit({ ...pEdit, email: e.target.value })} placeholder="contact@exemple.cm" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Ville</label>
                <input value={pEdit.ville} onChange={e => setPEdit({ ...pEdit, ville: e.target.value })} placeholder="Ex. Douala" style={INPUT}/>
              </div>
              <div>
                <label style={LABEL}>Quartier / zone</label>
                <input value={pEdit.quartier} onChange={e => setPEdit({ ...pEdit, quartier: e.target.value })} placeholder="Ex. Akwa, Bonabéri…" style={INPUT}/>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Note (optionnel)</label>
              <textarea value={pEdit.note} onChange={e => setPEdit({ ...pEdit, note: e.target.value })} placeholder="Conditions, remarques…" rows={2} style={{ ...INPUT, resize: 'vertical', fontFamily: 'var(--fs-font-sans)' }}/>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '9px 12px', fontSize: 11.5, color: '#1e40af', marginBottom: 18 }}>
              💡 Pas besoin de tout savoir maintenant : un partenaire peut démarrer <strong>sans agence</strong>, puis on lui ajoute ses agences (Douala, Yaoundé…) au fur et à mesure, avec « Ajouter une agence ».
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setPEdit(null)} style={BTN_GHOST}>Annuler</button>
              <button onClick={savePartenaire} style={{ ...BTN_PRIMARY, opacity: pEdit.nom.trim() ? 1 : 0.5 }}>{pEdit.id ? 'Enregistrer' : "Inscrire le partenaire"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
