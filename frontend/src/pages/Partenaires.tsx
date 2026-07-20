import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { getTokenPayload } from '../api/dashboard';
import { getBrandColor, contientTexte } from '../utils/text';
import { getAllProducts, Product } from '../api/products';
import {
  getPartenaires, createPartenaire, updatePartenaire, deletePartenaire,
  getLivraisons, createLivraison, updateLivraison, deleteLivraison, getDernierPrix,
  getCompte, createPaiement, getPartenairesStats, getCompteAgences, CompteAgences,
  getStatsAgences, StatsAgences, getOperations, Operation,
  getCommandes, createCommande, updateCommande, deleteCommande, createRetour,
  getAgences, createAgence, updateAgence, deleteAgence, preparerCommande,
  Partenaire, LivraisonPartenaire, ComptePartenaire, PartenairesStats,
  CommandePartenaire, ModePaiement, MODE_LABELS, Agence,
} from '../api/partenaires';
import { getUsers, createUser, updateUser, deleteUser, UserRecord } from '../api/auth';
import ToastContainer, { useToast } from '../components/Toast';
import { useIsMobile } from '../hooks/useIsMobile';

const fmtN = (n: number) => Math.round(n).toLocaleString('fr-FR');
function fmtDateTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' à ' + dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function I({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
  );
}
const D = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  cart:      'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6',
  key:       'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3',
  livraison: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  clients:   'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  compte:    'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  print:     'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  back:      'M19 12H5M12 19l-7-7 7-7',
  logout:    'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h12',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  edit:      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  chart:     'M3 3v18h18M7 15l3-4 3 2 4-6',
  clock:     'M12 7v5l3 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  bank:      'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
  user:      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  shop:      'M3 9l1-5h16l1 5M4 9v11h16V9M9 22v-6h6v6',
  link:      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  unlink:    'M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 8l8 8',
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
  padding: '9px 22px', background: 'var(--fs-wine-700)', color: '#fff',
  border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

// Sélecteur de produit (recherche) — uniquement l'entrepôt
function ProductSelect({ products, value, onChange }: {
  products: Product[]; value: string; onChange: (id: string) => void;
}) {
  const selected = products.find(p => p._id === value) ?? null;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  // Recherche insensible aux accents ; TOUS les résultats affichés, triés par nom
  // (une ancienne limite de 40 masquait des produits pourtant en entrepôt).
  const filtered = products
    .filter(p => !search.trim() || contientTexte(p.name, search) || contientTexte(p.barcode, search))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected?.name ?? '')}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(''); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chercher un produit (entrepôt)…"
        style={{ ...INPUT, cursor: 'text' }}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 8, boxShadow: 'var(--fs-shadow-md)', zIndex: 20, maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
          {filtered.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Aucun produit en entrepôt</div>}
          {filtered.length > 20 && (
            <div style={{ padding: '5px 12px', fontSize: 10, color: 'var(--fs-ink-400)', background: 'var(--fs-ivory)', position: 'sticky', top: 0 }}>
              {filtered.length} produits — tapez pour filtrer
            </div>
          )}
          {filtered.map(p => (
            <button key={p._id} type="button" onMouseDown={() => { onChange(p._id); setOpen(false); }}
              style={{ width: '100%', padding: '7px 12px', border: 'none', background: p._id === value ? 'var(--fs-ivory)' : '#fff', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--fs-line)', display: 'block' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>Entrepôt : {p.stockMagazin ?? 0} · Boutique : {p.stock}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'dashboard' | 'commandes' | 'preparer' | 'livraisons' | 'comptes' | 'rapport' | 'historique' | 'partenaires' | 'acces';
interface Row { productId: string; quantite: string; prix: string }

// Modal de modification d'un bon de livraison : quantités, prix, montant payé.
// Le stock entrepôt est ajusté automatiquement par différence côté serveur.
function EditLivraisonModal({ livraison, onClose, onSaved, onError }: {
  livraison: LivraisonPartenaire;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [lignes, setLignes] = useState(livraison.lignes.map(l => ({
    productId: String(l.productId), productName: l.productName,
    quantite: String(l.quantite), prix: String(l.prixUnitaire),
  })));
  const [paye, setPaye] = useState(String(livraison.montantPaye ?? 0));
  const [busy, setBusy] = useState(false);

  const setLigne = (i: number, patch: Partial<{ quantite: string; prix: string }>) =>
    setLignes(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  const retirer = (i: number) => setLignes(prev => prev.filter((_, j) => j !== i));

  const total = lignes.reduce((s, l) => s + (parseInt(l.quantite) || 0) * (parseInt(l.prix) || 0), 0);

  const enregistrer = async () => {
    const valides = lignes
      .map(l => ({ productId: l.productId, quantite: parseInt(l.quantite) || 0, prixUnitaire: parseInt(l.prix) || 0 }))
      .filter(l => l.quantite > 0);
    if (valides.length === 0) { onError('Gardez au moins un produit avec une quantité — sinon supprimez la livraison'); return; }
    setBusy(true);
    try {
      await updateLivraison(livraison._id, { lignes: valides, montantPaye: Math.max(0, parseInt(paye) || 0) });
      onSaved();
    } catch (e: unknown) { onError(e instanceof Error ? e.message : 'Erreur modification'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 26px', maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: 'var(--fs-ink-900)' }}>Modifier la livraison {livraison.numeroBL}</p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fs-ink-500)' }}>
          {typeof livraison.partenaire === 'object' ? livraison.partenaire.name : ''} — le stock entrepôt sera ajusté automatiquement (différence entre l'ancienne et la nouvelle quantité).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 76px 100px 32px', gap: 6, fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          <span>Produit</span><span style={{ textAlign: 'center' }}>Qté</span><span style={{ textAlign: 'center' }}>Prix U.</span><span/>
        </div>
        {lignes.map((l, i) => (
          <div key={l.productId} style={{ display: 'grid', gridTemplateColumns: '1fr 76px 100px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <div style={{ fontSize: 12.5, color: 'var(--fs-ink-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.productName}>{l.productName}</div>
            <input type="number" min={0} value={l.quantite} onChange={e => setLigne(i, { quantite: e.target.value })} style={{ ...INPUT, textAlign: 'center', padding: '7px 6px' }}/>
            <input type="number" min={0} value={l.prix} onChange={e => setLigne(i, { prix: e.target.value })} style={{ ...INPUT, textAlign: 'center', padding: '7px 6px' }}/>
            <button onClick={() => retirer(i)} title="Retirer ce produit (quantité remise en entrepôt)"
              style={{ padding: 6, border: '1px solid rgba(194,62,36,0.25)', borderRadius: 7, background: '#fef2f2', color: 'var(--fs-danger-700)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--fs-line)' }}>
          <div style={{ width: 150 }}>
            <label style={LABEL}>Montant payé (XAF)</label>
            <input type="number" min={0} value={paye} onChange={e => setPaye(e.target.value)} style={{ ...INPUT, textAlign: 'center' }}/>
          </div>
          <div style={{ flex: 1, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Nouveau total</span><strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(total)} XAF</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Reste dû</span><strong style={{ fontFamily: 'var(--fs-font-mono)', color: (total - (parseInt(paye) || 0)) > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(Math.max(0, total - (parseInt(paye) || 0)))} XAF</strong></div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '9px 18px', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          <button onClick={enregistrer} disabled={busy} style={{ ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 }}>{busy ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Partenaires({ embedded = false, allowedTabs, initialTab }: { embedded?: boolean; allowedTabs?: Tab[]; initialTab?: Tab } = {}) {
  const navigate = useNavigate();
  const brand = getBrandColor();
  const payload = getTokenPayload();
  const isPatron = payload?.role === 'patron';
  const { toasts, addToast, removeToast } = useToast();

  // Menu latéral repliable sur mobile (uniquement hors mode intégré)
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  const [tab, setTab] = useState<Tab>(initialTab ?? (allowedTabs ? allowedTabs[0] : 'dashboard'));
  const [stats, setStats] = useState<PartenairesStats | null>(null);
  const [statsAg, setStatsAg] = useState<StatsAgences | null>(null);
  const [ops, setOps] = useState<Operation[]>([]); // historique global
  const [partenaires, setPartenaires] = useState<Partenaire[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [livraisons, setLivraisons] = useState<LivraisonPartenaire[]>([]);

  // Formulaire livraison
  const [partId, setPartId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ productId: '', quantite: '1', prix: '' }]);
  const [montantPaye, setMontantPaye] = useState('');
  const [livMode, setLivMode] = useState<ModePaiement>('credit');
  const [dernierPrix, setDernierPrix] = useState<Record<string, number>>({});
  const [loadingLiv, setLoadingLiv] = useState(false);

  // Formulaire commande
  const [commandes, setCommandes] = useState<CommandePartenaire[]>([]);
  const [cmdPartId, setCmdPartId] = useState('');
  const [cmdAgenceId, setCmdAgenceId] = useState('');
  const [cmdAgences, setCmdAgences] = useState<Agence[]>([]); // agences du partenaire sélectionné (commande)
  const [cmdRows, setCmdRows] = useState<Row[]>([{ productId: '', quantite: '1', prix: '' }]);
  const [cmdMode, setCmdMode] = useState<ModePaiement>('credit');
  const [cmdDelai, setCmdDelai] = useState('');
  const [cmdDernierPrix, setCmdDernierPrix] = useState<Record<string, number>>({});

  // Charge les agences (actives) du partenaire choisi pour la commande
  useEffect(() => {
    setCmdAgenceId('');
    if (cmdPartId) getAgences(cmdPartId).then(list => setCmdAgences(list.filter(a => !a.archivee))).catch(() => setCmdAgences([]));
    else setCmdAgences([]);
  }, [cmdPartId]);

  // Toutes les agences (pour afficher le nom sur les commandes / préparation)
  const [allAgences, setAllAgences] = useState<Agence[]>([]);
  const agenceLabel = (id?: string | null) => {
    if (!id) return '';
    const a = allAgences.find(x => x._id === id);
    return a ? `${a.nom}${a.ville ? ' · ' + a.ville : ''}` : '';
  };

  // Onglet « À préparer » : quantités servies par le magasinier
  const [prepQty, setPrepQty] = useState<Record<string, string>>({}); // clé `${cmdId}|${productId}`
  const [prepLoading, setPrepLoading] = useState<string | null>(null);

  // Anti double-clic : verrou synchrone (le state React est trop lent pour deux
  // clics dans la même frame) + clé d'idempotence réutilisée en cas de retry —
  // le serveur ne créera JAMAIS deux livraisons pour la même validation.
  const envoiEnCoursRef = useRef(false);
  const idemKeysRef = useRef<Record<string, string>>({});
  const genKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const resteLigne = (l: { quantite: number; quantiteLivree?: number }) => Math.max(0, (l.quantite ?? 0) - (l.quantiteLivree ?? 0));

  // Impression d'un bon (commande ou livraison)
  const STYLE_BON = `body{font-family:Arial,sans-serif;padding:24px;color:#111}h2{margin:0}.sub{color:#666;font-size:13px;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{border:1px solid #999;padding:6px 8px}th{background:#f0f0f0;text-align:left}.tot{margin-top:14px;font-size:16px;font-weight:bold;color:${brand}}.sign{margin-top:46px;display:flex;justify-content:space-between;font-size:12px;color:#444}`;
  const lignesHtml = (lignes: { productName: string; quantite: number; prixUnitaire: number }[]) =>
    lignes.map(l => `<tr><td>${l.productName}</td><td style="text-align:center">${l.quantite}</td><td style="text-align:right">${fmtN(l.prixUnitaire)}</td><td style="text-align:right">${fmtN(l.quantite * l.prixUnitaire)}</td></tr>`).join('');

  const imprimerCommande = (c: CommandePartenaire) => {
    const part = typeof c.partenaire === 'object' ? c.partenaire.name : '—';
    const ag = agenceLabel(c.agence);
    const tot = c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
    const win = window.open('', '_blank', 'width=800,height=900'); if (!win) return;
    win.document.write(`<html><head><title>Bon de commande ${c.numero}</title><style>${STYLE_BON}</style></head><body>
      <h2>Bon de commande — ${part}</h2>
      <div class="sub">${[ag, c.numero, new Date(c.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}</div>
      <table><thead><tr><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix U.</th><th style="text-align:right">Montant</th></tr></thead><tbody>${lignesHtml(c.lignes)}</tbody></table>
      <div class="tot">Total estimé : ${fmtN(tot)} XAF</div>
      <div class="sign"><div>Cachet / signature magasin</div><div>Signature partenaire</div></div>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  };

  const imprimerLivraison = (liv: LivraisonPartenaire, part: string, ag: string) => {
    const win = window.open('', '_blank', 'width=800,height=900'); if (!win) return;
    win.document.write(`<html><head><title>Bon de livraison ${liv.numeroBL}</title><style>${STYLE_BON}</style></head><body>
      <h2>Bon de livraison — ${part}</h2>
      <div class="sub">${[ag, liv.numeroBL, new Date().toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}</div>
      <table><thead><tr><th>Produit</th><th style="text-align:center">Qté livrée</th><th style="text-align:right">Prix U.</th><th style="text-align:right">Montant</th></tr></thead><tbody>${lignesHtml(liv.lignes)}</tbody></table>
      <div class="tot">Total : ${fmtN(liv.total)} XAF</div>
      <div style="margin-top:6px;font-size:13px">Payé : ${fmtN(liv.montantPaye)} XAF &nbsp;·&nbsp; Reste dû : ${fmtN(Math.max(0, liv.total - liv.montantPaye))} XAF</div>
      <div class="sign"><div>Cachet / signature magasin</div><div>Reçu par (partenaire)</div></div>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    win.document.close();
  };

  const validerPreparation = async (cmd: CommandePartenaire) => {
    const lignes = cmd.lignes.map(l => {
      const k = `${cmd._id}|${l.productId}`;
      const saisi = prepQty[k];
      const q = (saisi !== undefined && saisi !== '') ? (parseInt(saisi) || 0) : resteLigne(l);
      return { productId: l.productId, quantite: q, prixUnitaire: l.prixUnitaire };
    }).filter(l => l.quantite > 0);
    if (lignes.length === 0) { addToast('Saisissez au moins une quantité à servir', 'error'); return; }
    const rupture = lignes.find(l => l.quantite > (products.find(p => p._id === l.productId)?.stockMagazin ?? 0));
    if (rupture) {
      const nom = cmd.lignes.find(x => String(x.productId) === String(rupture.productId))?.productName ?? 'produit';
      addToast(`Stock entrepôt insuffisant pour « ${nom} » — réduisez la quantité à servir`, 'error');
      return;
    }
    if (envoiEnCoursRef.current) return; // double-clic : le 2ᵉ clic est ignoré
    envoiEnCoursRef.current = true;
    setPrepLoading(cmd._id);
    // Même clé si l'on re-valide après une erreur réseau → jamais de doublon
    const idemKey = idemKeysRef.current[cmd._id] ?? (idemKeysRef.current[cmd._id] = genKey());
    try {
      const res = await preparerCommande(cmd._id, { lignes, idempotencyKey: idemKey });
      delete idemKeysRef.current[cmd._id];
      addToast('Livraison enregistrée ✓ — stock entrepôt mis à jour', 'success');
      const partNom = typeof cmd.partenaire === 'object' ? cmd.partenaire.name : '—';
      imprimerLivraison(res.livraison, partNom, agenceLabel(cmd.agence));
      setPrepQty(prev => { const c = { ...prev }; cmd.lignes.forEach(l => delete c[`${cmd._id}|${l.productId}`]); return c; });
      loadCommandes();
      getAllProducts().then(setProducts).catch(() => {});
      getLivraisons().then(setLivraisons).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
    finally { envoiEnCoursRef.current = false; setPrepLoading(null); }
  };

  // Retour d'invendus (comptes)
  const [retourRows, setRetourRows] = useState<Row[]>([{ productId: '', quantite: '1', prix: '' }]);
  const [showRetour, setShowRetour] = useState(false);

  // Comptes commerciaux (accès — patron uniquement)
  const [commerciaux, setCommerciaux] = useState<UserRecord[]>([]);
  const [accForm, setAccForm] = useState({ name: '', email: '', password: '' });
  const loadCommerciaux = () => { getUsers().then(us => setCommerciaux(us.filter(u => u.role === 'commercial'))).catch(() => {}); };

  const creerCommercial = async () => {
    if (!accForm.name.trim() || !accForm.email.trim() || accForm.password.length < 4) {
      addToast('Nom, email et mot de passe (≥ 4 caractères) requis', 'error'); return;
    }
    try {
      await createUser({ name: accForm.name.trim(), email: accForm.email.trim().toLowerCase(), password: accForm.password, role: 'commercial' });
      addToast('Compte commercial créé ✓', 'success');
      setAccForm({ name: '', email: '', password: '' });
      loadCommerciaux();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const resetPassword = async (id: string) => {
    const np = window.prompt('Nouveau mot de passe (≥ 4 caractères) :');
    if (!np || np.length < 4) { if (np !== null) addToast('Mot de passe trop court', 'error'); return; }
    try { await updateUser(id, { password: np }); addToast('Mot de passe réinitialisé ✓', 'success'); }
    catch { addToast('Erreur', 'error'); }
  };

  const supprimerCommercial = async (id: string) => {
    try { await deleteUser(id); setCommerciaux(prev => prev.filter(u => u._id !== id)); addToast('Compte supprimé', 'success'); }
    catch { addToast('Erreur suppression', 'error'); }
  };

  // Formulaire partenaire (fiche d'inscription)
  const PFORM_VIDE = { name: '', phone: '', ville: '', quartier: '', responsable: '', email: '', note: '', type: 'structure' as 'structure' | 'particulier', ancienneDette: '' };
  const [pForm, setPForm] = useState({ ...PFORM_VIDE });
  const [editing, setEditing] = useState<string | null>(null);
  const [showPartModal, setShowPartModal] = useState(false); // modal fiche partenaire (vue détail maquette)
  const ouvrirNouveauPartenaire = () => { setEditing(null); setPForm({ ...PFORM_VIDE }); setShowPartModal(true); };
  const ouvrirEditPartenaire = (p: Partenaire) => { setEditing(p._id); setPForm({ name: p.name, phone: p.phone, ville: p.ville ?? '', quartier: p.quartier ?? '', responsable: p.responsable ?? '', email: p.email ?? '', note: p.note, type: p.type ?? 'structure', ancienneDette: p.ancienneDette ? String(p.ancienneDette) : '' }); setShowPartModal(true); };

  // Gestion des agences (par partenaire)
  const [agences, setAgences] = useState<Agence[]>([]);
  const [agencesPartId, setAgencesPartId] = useState<string | null>(null); // partenaire dont on gère les agences
  type AForm = { id: string | null; nom: string; ville: string; quartier: string; telephone: string; responsable: string; independante: boolean };
  const [aForm, setAForm] = useState<AForm | null>(null);

  const loadAgences = (partId: string) => { getAgences(partId).then(setAgences).catch(() => setAgences([])); };
  // Rafraîchit la liste des agences + la dette (compteAg) + la liste/sidebar (statsAg)
  const rafraichirDette = (partId: string) => {
    loadAgences(partId);
    getCompteAgences(partId).then(setCompteAg).catch(() => {});
    getStatsAgences().then(setStatsAg).catch(() => {});
  };
  const ouvrirAgences = (partId: string) => { setAgencesPartId(partId); setAForm(null); loadAgences(partId); };
  const ouvrirNouvelleAgence = (p?: Partenaire) => setAForm({ id: null, nom: '', ville: p?.ville ?? '', quartier: '', telephone: '', responsable: '', independante: false });
  const ouvrirEditAgence = (a: Agence) => setAForm({ id: a._id, nom: a.nom, ville: a.ville ?? '', quartier: a.quartier ?? '', telephone: a.telephone ?? '', responsable: a.responsable ?? '', independante: a.independante });

  const saveAgence = async () => {
    if (!aForm || !agencesPartId) return;
    const nom = aForm.nom.trim();
    if (!nom) { addToast("Le nom de l'agence est requis", 'error'); return; }
    try {
      if (aForm.id) {
        await updateAgence(aForm.id, { nom, ville: aForm.ville.trim(), quartier: aForm.quartier.trim(), telephone: aForm.telephone.trim(), responsable: aForm.responsable.trim(), independante: aForm.independante });
        addToast('Agence modifiée ✓', 'success');
      } else {
        await createAgence({ partenaireId: agencesPartId, nom, ville: aForm.ville.trim(), quartier: aForm.quartier.trim(), telephone: aForm.telephone.trim(), responsable: aForm.responsable.trim(), independante: aForm.independante });
        addToast('Agence ajoutée ✓', 'success');
      }
      setAForm(null); rafraichirDette(agencesPartId);
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const toggleIndependante = async (a: Agence) => {
    try { await updateAgence(a._id, { independante: !a.independante }); if (agencesPartId) rafraichirDette(agencesPartId); }
    catch { addToast('Erreur', 'error'); }
  };
  const reactiverAgence = async (a: Agence) => {
    try { await updateAgence(a._id, { archivee: false }); if (agencesPartId) rafraichirDette(agencesPartId); }
    catch { addToast('Erreur', 'error'); }
  };
  const supprimerAgence = async (a: Agence) => {
    if (!window.confirm(`Supprimer l'agence « ${a.nom} » ?\n\nSi elle a un historique, elle sera ARCHIVÉE (conservée dans les totaux), sinon supprimée.`)) return;
    try {
      const r = await deleteAgence(a._id);
      addToast(r.archived ? 'Agence archivée (historique conservé)' : 'Agence supprimée', 'success');
      if (agencesPartId) rafraichirDette(agencesPartId);
    } catch { addToast('Erreur suppression', 'error'); }
  };
  const setToutesAgences = async (independante: boolean) => {
    if (!compteId) return;
    const cibles = agences.filter(a => !a.archivee);
    if (cibles.length === 0) return;
    try {
      await Promise.all(cibles.map(a => updateAgence(a._id, { independante })));
      rafraichirDette(compteId);
      addToast(independante ? 'Toutes les agences sont indépendantes' : 'Toutes les agences en dette commune', 'success');
    } catch { addToast('Erreur', 'error'); }
  };

  // Comptes (relevé)
  const [compteId, setCompteId] = useState('');
  const [compte, setCompte] = useState<ComptePartenaire | null>(null);
  const [compteAg, setCompteAg] = useState<CompteAgences | null>(null); // ventilation par agence
  const [paieMontant, setPaieMontant] = useState('');
  const [paieNote, setPaieNote] = useState('');
  const [paieAgenceId, setPaieAgenceId] = useState(''); // '' = versement commun/global
  const [montantCommun, setMontantCommun] = useState(''); // versement libre sur la dette commune

  const loadCompte = (id: string) => {
    if (!id) { setCompte(null); setCompteAg(null); return; }
    getCompte(id).then(setCompte).catch(() => setCompte(null));
    getCompteAgences(id).then(setCompteAg).catch(() => setCompteAg(null));
  };
  useEffect(() => {
    loadCompte(compteId);
    setPaieAgenceId('');
    if (compteId) { setAgencesPartId(compteId); loadAgences(compteId); }
  }, [compteId]);

  const enregistrerPaiement = async () => {
    const montant = parseInt(paieMontant) || 0;
    if (!compteId || montant <= 0) { addToast('Saisissez un montant', 'error'); return; }
    try {
      await createPaiement(compteId, { montant, note: paieNote.trim() || undefined, agenceId: paieAgenceId || null });
      addToast('Versement enregistré ✓', 'success');
      setPaieMontant(''); setPaieNote(''); setPaieAgenceId('');
      loadCompte(compteId);
      getStatsAgences().then(setStatsAg).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  // Versement libre sur la dette commune (agence = null)
  const enregistrerVersementCommun = async () => {
    const montant = parseInt(montantCommun) || 0;
    if (!compteId || montant <= 0) { addToast('Saisissez un montant', 'error'); return; }
    try {
      await createPaiement(compteId, { montant, agenceId: null });
      addToast('Versement enregistré ✓', 'success');
      setMontantCommun('');
      loadCompte(compteId);
      getStatsAgences().then(setStatsAg).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const imprimerReleve = () => {
    if (!compte) return;
    const c = compte;
    const lignesHtml = [
      ...c.livraisons.map(l => `<tr><td>${fmtDateTime(l.createdAt)}</td><td>Livraison ${l.numeroBL}</td><td style="text-align:right">${fmtN(l.total)}</td><td style="text-align:right">${fmtN(l.montantPaye)}</td></tr>`),
      ...c.paiements.map(p => `<tr><td>${fmtDateTime(p.createdAt)}</td><td>Paiement${p.note ? ' — ' + p.note : ''}</td><td></td><td style="text-align:right">${fmtN(p.montant)}</td></tr>`),
    ].join('');
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html><head><title>Relevé — ${c.partenaire.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h2{margin:0 0 2px} .sub{color:#666;font-size:13px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
        th,td{border:1px solid #999;padding:6px 8px} th{background:#f0f0f0;text-align:left}
        .tot{margin-top:16px;font-size:15px} .solde{font-size:20px;font-weight:bold;color:${brand}}
      </style></head><body>
        <h2>Relevé de compte — ${c.partenaire.name}</h2>
        <div class="sub">${[c.partenaire.lieu, c.partenaire.phone].filter(Boolean).join(' · ')} &middot; Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
        <table>
          <thead><tr><th>Date</th><th>Opération</th><th style="text-align:right">Montant livré</th><th style="text-align:right">Payé</th></tr></thead>
          <tbody>${lignesHtml || '<tr><td colspan="4" style="text-align:center;color:#888">Aucune opération</td></tr>'}</tbody>
        </table>
        <div class="tot">Total livré : <b>${fmtN(c.totalLivre)} XAF</b> &nbsp;·&nbsp; Total payé : <b>${fmtN(c.payeLivraison + c.totalPaiements)} XAF</b></div>
        <div class="tot solde">Solde dû : ${fmtN(c.solde)} XAF</div>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>`);
    win.document.close();
  };

  const warehouse = useMemo(() => products.filter(p => (p.stockMagazin ?? 0) > 0), [products]);

  const loadStats = () => { getPartenairesStats().then(setStats).catch(() => {}); getStatsAgences().then(setStatsAg).catch(() => {}); };
  const loadCommandes = () => { getCommandes().then(setCommandes).catch(() => {}); };
  const loadAll = () => {
    getPartenaires().then(setPartenaires).catch(() => {});
    getAllProducts().then(setProducts).catch(() => {});
    getLivraisons().then(setLivraisons).catch(() => {});
    getAgences().then(setAllAgences).catch(() => {});
    loadCommandes();
    loadStats();
  };
  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    if (tab === 'dashboard' || tab === 'rapport') loadStats();
    if (tab === 'rapport' || tab === 'historique') getLivraisons().then(setLivraisons).catch(() => {});
    if (tab === 'historique') getOperations().then(setOps).catch(() => {});
    if (tab === 'acces') loadCommerciaux();
  }, [tab]);

  // Rappel des derniers prix pour la commande
  useEffect(() => {
    if (cmdPartId) getDernierPrix(cmdPartId).then(setCmdDernierPrix).catch(() => setCmdDernierPrix({}));
    else setCmdDernierPrix({});
  }, [cmdPartId]);

  const setCmdRow = (i: number, patch: Partial<Row>) => setCmdRows(r => r.map((row, n) => n === i ? { ...row, ...patch } : row));
  const addCmdRow = () => setCmdRows(r => [...r, { productId: '', quantite: '1', prix: '' }]);
  const removeCmdRow = (i: number) => setCmdRows(r => r.length === 1 ? [{ productId: '', quantite: '1', prix: '' }] : r.filter((_, n) => n !== i));
  const cmdTotal = cmdRows.reduce((s, r) => s + (parseInt(r.quantite) || 0) * (parseInt(r.prix) || 0), 0);

  const [editingCmd, setEditingCmd] = useState<string | null>(null); // id de la commande en cours de modification

  const chargerCommandePourEdition = (c: CommandePartenaire) => {
    setEditingCmd(c._id);
    setCmdPartId(typeof c.partenaire === 'object' ? c.partenaire._id : c.partenaire);
    setCmdAgenceId(c.agence ?? '');
    setCmdMode(c.modePaiement);
    setCmdDelai(c.delai ? String(c.delai) : '');
    setCmdRows(c.lignes.length ? c.lignes.map(l => ({ productId: String(l.productId), quantite: String(l.quantite), prix: String(l.prixUnitaire) })) : [{ productId: '', quantite: '1', prix: '' }]);
    window.scrollTo(0, 0);
  };
  const annulerEditionCmd = () => {
    setEditingCmd(null);
    setCmdRows([{ productId: '', quantite: '1', prix: '' }]); setCmdDelai(''); setCmdAgenceId('');
  };

  const validerCommande = async () => {
    if (!cmdPartId) { addToast('Choisissez un partenaire', 'error'); return; }
    const lignes = cmdRows.filter(r => r.productId && (parseInt(r.quantite) || 0) > 0)
      .map(r => ({ productId: r.productId, quantite: parseInt(r.quantite) || 0, prixUnitaire: parseInt(r.prix) || 0 }));
    if (lignes.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    try {
      if (editingCmd) {
        await updateCommande(editingCmd, { agenceId: cmdAgenceId || null, modePaiement: cmdMode, delai: parseInt(cmdDelai) || 0, lignes });
        addToast('Commande modifiée ✓', 'success');
        setEditingCmd(null);
      } else {
        await createCommande({ partenaireId: cmdPartId, agenceId: cmdAgenceId || null, modePaiement: cmdMode, delai: parseInt(cmdDelai) || 0, lignes });
        addToast('Commande enregistrée ✓', 'success');
      }
      setCmdRows([{ productId: '', quantite: '1', prix: '' }]); setCmdDelai(''); setCmdAgenceId('');
      loadCommandes();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  // Clôture d'une commande partielle : le reliquat non servi ne sera jamais livré
  // (rupture, produit remplacé…) — la commande passe en « Livrée » sans mouvement.
  const [confirmClotureId, setConfirmClotureId] = useState<string | null>(null);
  const cloturerCommande = async (c: CommandePartenaire) => {
    try {
      await updateCommande(c._id, { statut: 'livree' });
      addToast(`Commande ${c.numero} clôturée ✓ — le reliquat non servi est abandonné`, 'success');
      setConfirmClotureId(null);
      loadCommandes();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const supprimerCommande = async (c: CommandePartenaire) => {
    const livree = c.statut === 'livree' || c.statut === 'partielle';
    const msg = livree
      ? `Cette commande a déjà été (partiellement) livrée.\n\nLa supprimer va ANNULER la/les livraison(s) : le stock sera RESTITUÉ à l'entrepôt et la dette correspondante disparaîtra.\n\nConfirmer ?`
      : 'Supprimer cette commande ?';
    if (!window.confirm(msg)) return;
    try {
      const r = await deleteCommande(c._id);
      setCommandes(prev => prev.filter(x => x._id !== c._id));
      addToast(r.livraisonsAnnulees > 0 ? `Commande annulée ✓ — ${r.produitsRestitues} article(s) restitué(s) en entrepôt` : 'Commande supprimée', 'success');
      getAllProducts().then(setProducts).catch(() => {});
      getLivraisons().then(setLivraisons).catch(() => {});
      loadCommandes();
      if (compteId) loadCompte(compteId);
      getStatsAgences().then(setStatsAg).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur suppression', 'error'); }
  };

  // Retour d'invendus
  const setRetourRow = (i: number, patch: Partial<Row>) => setRetourRows(r => r.map((row, n) => n === i ? { ...row, ...patch } : row));
  const addRetourRow = () => setRetourRows(r => [...r, { productId: '', quantite: '1', prix: '' }]);
  const removeRetourRow = (i: number) => setRetourRows(r => r.length === 1 ? [{ productId: '', quantite: '1', prix: '' }] : r.filter((_, n) => n !== i));
  const enregistrerRetour = async () => {
    const lignes = retourRows.filter(r => r.productId && (parseInt(r.quantite) || 0) > 0)
      .map(r => ({ productId: r.productId, quantite: parseInt(r.quantite) || 0, prixUnitaire: parseInt(r.prix) || 0 }));
    if (!compteId || lignes.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    try {
      await createRetour(compteId, { lignes });
      addToast('Retour enregistré ✓ — remis en entrepôt', 'success');
      setRetourRows([{ productId: '', quantite: '1', prix: '' }]); setShowRetour(false);
      loadCompte(compteId); getAllProducts().then(setProducts).catch(() => {});
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  // Rappel des derniers prix quand on change de partenaire
  useEffect(() => {
    if (partId) getDernierPrix(partId).then(setDernierPrix).catch(() => setDernierPrix({}));
    else setDernierPrix({});
  }, [partId]);

  const setRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((row, n) => n === i ? { ...row, ...patch } : row));
  const addRow = () => setRows(r => [...r, { productId: '', quantite: '1', prix: '' }]);
  const removeRow = (i: number) => setRows(r => r.length === 1 ? [{ productId: '', quantite: '1', prix: '' }] : r.filter((_, n) => n !== i));

  const total = rows.reduce((s, r) => s + (parseInt(r.quantite) || 0) * (parseInt(r.prix) || 0), 0);
  const creance = Math.max(0, total - (parseInt(montantPaye) || 0));

  const validerLivraison = async () => {
    if (!partId) { addToast('Choisissez un partenaire', 'error'); return; }
    const lignes = rows
      .filter(r => r.productId && (parseInt(r.quantite) || 0) > 0)
      .map(r => ({ productId: r.productId, quantite: parseInt(r.quantite) || 0, prixUnitaire: parseInt(r.prix) || 0 }));
    if (lignes.length === 0) { addToast('Ajoutez au moins un produit', 'error'); return; }
    if (envoiEnCoursRef.current) return; // double-clic ignoré
    envoiEnCoursRef.current = true;
    setLoadingLiv(true);
    const idemKey = idemKeysRef.current['liv-directe'] ?? (idemKeysRef.current['liv-directe'] = genKey());
    try {
      await createLivraison(partId, { lignes, montantPaye: parseInt(montantPaye) || 0, modePaiement: livMode, idempotencyKey: idemKey });
      delete idemKeysRef.current['liv-directe'];
      addToast('Bon de livraison validé ✓ — stock entrepôt mis à jour', 'success');
      setRows([{ productId: '', quantite: '1', prix: '' }]);
      setMontantPaye('');
      getAllProducts().then(setProducts).catch(() => {});
      getLivraisons().then(setLivraisons).catch(() => {});
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Erreur', 'error');
    } finally { envoiEnCoursRef.current = false; setLoadingLiv(false); }
  };

  // ── Suppression / modification d'un bon de livraison ─────────────────────────
  const [confirmDelLivId, setConfirmDelLivId] = useState<string | null>(null);
  const [editLiv, setEditLiv] = useState<LivraisonPartenaire | null>(null);

  const rechargerApresLivraison = () => {
    getAllProducts().then(setProducts).catch(() => {});
    getLivraisons().then(setLivraisons).catch(() => {});
    getOperations().then(setOps).catch(() => {});
    loadCommandes();
    getStatsAgences().then(setStatsAg).catch(() => {});
  };

  const supprimerLivraison = async (id: string) => {
    try {
      const r = await deleteLivraison(id);
      addToast(`Livraison supprimée ✓ — ${r.produitsRestitues} article(s) remis en stock entrepôt`, 'success');
      setConfirmDelLivId(null);
      rechargerApresLivraison();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur suppression', 'error'); }
  };

  // Retrouve la livraison complète depuis son id (l'historique n'a que l'id)
  const ouvrirEditLivraison = (id: string) => {
    const liv = livraisons.find(l => l._id === id);
    if (liv) { setEditLiv(liv); return; }
    getLivraisons().then(ls => {
      setLivraisons(ls);
      const found = ls.find(l => l._id === id);
      if (found) setEditLiv(found);
      else addToast('Livraison introuvable', 'error');
    }).catch(() => addToast('Erreur chargement', 'error'));
  };

  const savePartenaire = async () => {
    if (!pForm.name.trim()) { addToast('Le nom du partenaire est requis', 'error'); return; }
    try {
      let nouvelId: string | null = null;
      const payload = { ...pForm, ancienneDette: Math.max(0, parseInt(pForm.ancienneDette) || 0) };
      if (editing) { await updatePartenaire(editing, payload); addToast('Partenaire modifié ✓', 'success'); }
      else { const cree = await createPartenaire(payload); nouvelId = cree._id; addToast('Partenaire ajouté ✓', 'success'); }
      setPForm({ ...PFORM_VIDE });
      setEditing(null);
      setShowPartModal(false);
      getPartenaires().then(setPartenaires).catch(() => {});
      getStatsAgences().then(setStatsAg).catch(() => {});
      if (editing) rafraichirDette(editing); // la dette affichée intègre l'ancienne dette modifiée
      if (nouvelId) { setCompteId(nouvelId); ouvrirAgences(nouvelId); setTab('comptes'); }
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : 'Erreur', 'error'); }
  };

  const removePartenaire = async (id: string) => {
    try { await deletePartenaire(id); setPartenaires(prev => prev.filter(p => p._id !== id)); addToast('Partenaire supprimé', 'success'); }
    catch { addToast('Erreur suppression', 'error'); }
  };

  const initials = (payload?.name ?? '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const TAB_TITLES: Record<string, string> = {
    dashboard: 'Tableau de bord', commandes: 'Commandes grossistes', preparer: 'Commandes à préparer',
    livraisons: 'Bon de livraison', comptes: 'Comptes & créances', rapport: 'Rapport & analyse',
    historique: 'Historique', acces: 'Comptes de connexion Partenaires', partenaires: 'Partenaires',
  };
  const TAB_LABELS: Record<string, string> = {
    dashboard: 'Tableau de bord', commandes: 'Commandes', preparer: 'À préparer',
    livraisons: 'Livraisons', comptes: 'Comptes', rapport: 'Rapport', historique: 'Historique',
    acces: 'Accès', partenaires: 'Partenaires',
  };

  // Refermer le menu latéral (mobile) après navigation
  useEffect(() => { setNavOpen(false); }, [tab, compteId]);

  const mobileNav = !embedded && isMobile;

  return (
    <div style={embedded
      ? { display: 'flex', width: '100%', height: '100%', overflow: 'hidden', fontFamily: 'var(--fs-font-sans)' }
      : { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, fontFamily: 'var(--fs-font-sans)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Modal de modification d'un bon de livraison */}
      {editLiv && (
        <EditLivraisonModal
          livraison={editLiv}
          onClose={() => setEditLiv(null)}
          onSaved={() => { setEditLiv(null); addToast('Livraison modifiée ✓ — stock entrepôt ajusté', 'success'); rechargerApresLivraison(); }}
          onError={m => addToast(m, 'error')}
        />
      )}

      {/* Bouton hamburger (mobile, hors mode intégré) */}
      {mobileNav && (
        <button onClick={() => setNavOpen(o => !o)} aria-label={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          style={{ position: 'fixed', top: 12, left: navOpen ? 208 : 12, zIndex: 201, width: 40, height: 40, borderRadius: 10, border: 'none', background: 'var(--fs-wine-700)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', transition: 'left 0.25s' }}>
          <I d={navOpen ? 'M18 6L6 18M6 6l12 12' : 'M3 12h18M3 6h18M3 18h18'} size={16}/>
        </button>
      )}

      {/* Voile sombre quand le menu mobile est ouvert */}
      {mobileNav && navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199, background: 'rgba(0,0,0,0.5)' }}/>
      )}

      {/* Sidebar (masquée en mode intégré) */}
      {!embedded && (
      <aside className="fs-sidebar-drawer" style={{
        width: 200, background: 'var(--fs-wine-900)', display: 'flex', flexDirection: 'column', flexShrink: 0,
        ...(mobileNav ? { position: 'fixed', top: 0, left: navOpen ? 0 : -216, height: '100vh', zIndex: 200, boxShadow: navOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none', transition: 'left 0.25s' } : {}),
      }}>
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--fs-gold-500)', marginBottom: 4 }}>Family Store</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Partenaires</div>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {([
            { key: 'dashboard', label: 'Tableau de bord', icon: D.dashboard },
            { key: 'rapport', label: 'Rapport & analyse', icon: D.chart },
            { key: 'historique', label: 'Historique', icon: D.clock },
            ...(isPatron ? [{ key: 'acces' as Tab, label: 'Comptes de connexion', icon: D.key }] : []),
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', marginBottom: 2,
              borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13,
              background: tab === t.key ? 'var(--fs-wine-700)' : 'transparent',
              borderLeft: tab === t.key ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              color: tab === t.key ? '#fff' : 'rgba(245,235,217,0.65)', fontWeight: tab === t.key ? 600 : 400,
              fontFamily: 'var(--fs-font-sans)',
            }}>
              <span style={{ color: tab === t.key ? 'var(--fs-gold-300)' : 'var(--fs-gold-500)' }}><I d={t.icon} size={15}/></span>
              {t.label}
            </button>
          ))}

          {/* Liste des partenaires (clic → détail) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 10px 6px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Partenaires</span>
            <button onClick={ouvrirNouveauPartenaire} title="Nouveau partenaire" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.08)', color: 'var(--fs-gold-300)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><I d={D.plus} size={11}/> Nouveau</button>
          </div>
          {partenaires.length === 0 && <div style={{ fontSize: 11, color: 'rgba(245,235,217,0.4)', padding: '4px 10px' }}>Aucun partenaire — clique « Nouveau ».</div>}
          {partenaires.map(p => {
            const active = tab === 'comptes' && compteId === p._id;
            const solde = (statsAg?.debiteurs ?? []).filter(d => d.partenaireId === p._id).reduce((s, d) => s + d.solde, 0);
            return (
              <button key={p._id} onClick={() => { setCompteId(p._id); ouvrirAgences(p._id); setTab('comptes'); }} style={{
                width: '100%', textAlign: 'left', marginBottom: 3, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: 'none',
                background: active ? 'var(--fs-wine-700)' : 'rgba(255,255,255,0.03)',
                borderLeft: active ? '2px solid var(--fs-gold-400)' : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: 'var(--fs-gold-400)', flexShrink: 0 }}><I d={p.type === 'particulier' ? D.user : D.bank} size={14}/></span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </div>
                <div style={{ fontSize: 10.5, color: solde > 0 ? '#fca5a5' : '#86efac', fontWeight: 700, fontFamily: 'var(--fs-font-mono)', marginTop: 3 }}>Dette : {fmtN(solde)} XAF</div>
              </button>
            );
          })}

          <div style={{ margin: '10px 6px 4px', padding: '9px 10px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--fs-gold-400)' }}><I d={D.shop} size={13}/></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,235,217,0.85)' }}>Présentoir</span>
            </div>
            <div style={{ fontSize: 9.5, color: 'rgba(245,235,217,0.5)', marginTop: 3 }}>Géré comme un partenaire : crée-le avec « Nouveau » (nom « Présentoir »).</div>
          </div>
        </nav>

        {isPatron && (
          <div style={{ padding: '0 12px 8px' }}>
            <button onClick={() => navigate('/admin/dashboard')}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--fs-gold-300)', cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <I d={D.back} size={13}/> Retour admin
            </button>
          </div>
        )}

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--fs-gold-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payload?.name ?? '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--fs-gold-400)' }}>{isPatron ? 'Administrateur' : payload?.role === 'commercial' ? 'Compte Partenaires' : 'Magasinier'}</div>
          </div>
          <button onClick={() => { localStorage.removeItem('access_token'); window.location.href = '/login'; }}
            style={{ background: 'none', border: 'none', color: 'var(--fs-gold-400)', cursor: 'pointer', padding: 2 }} title="Déconnexion">
            <I d={D.logout} size={14}/>
          </button>
        </div>
      </aside>
      )}

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isMobile ? 'auto' : 'hidden', background: 'var(--fs-ivory)' }}>
        {embedded ? (
          <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: '10px 16px', flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(allowedTabs ?? (['commandes', 'preparer'] as Tab[])).map(k => (
              <button key={k} onClick={() => setTab(k)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: tab === k ? 'none' : '1.5px solid var(--fs-line-2)',
                background: tab === k ? 'var(--fs-wine-700)' : '#fff', color: tab === k ? '#fff' : 'var(--fs-ink-600)',
              }}>{TAB_LABELS[k]}</button>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', borderBottom: '1px solid var(--fs-line)', padding: isMobile ? '12px 16px' : '12px 28px', flexShrink: 0, paddingLeft: mobileNav ? 60 : undefined }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 2px' }}>Espace Partenaires</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0 }}>{tab === 'comptes' ? (compteAg ? compteAg.partenaire.name : 'Détail partenaire') : (TAB_TITLES[tab] ?? 'Partenaires')}</h1>
          </div>
        )}

        <div style={{ flex: isMobile ? '0 0 auto' : 1, overflowY: isMobile ? 'visible' : 'auto', padding: embedded ? '18px 16px' : (isMobile ? '16px 14px' : '20px 28px') }}>

          {/* ── Onglet Tableau de bord ── */}
          {tab === 'dashboard' && (
            <div style={{ maxWidth: 980 }}>
              {/* Métriques */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Créances totales', val: `${fmtN(stats?.totalCreances ?? 0)} XAF`, color: 'var(--fs-danger-700)', sub: 'Reste dû par les partenaires' },
                  { label: 'Total livré', val: `${fmtN(stats?.totalLivre ?? 0)} XAF`, color: 'var(--fs-ink-900)', sub: 'Cumul des bons de livraison' },
                  { label: 'Total encaissé', val: `${fmtN(stats?.totalEncaisse ?? 0)} XAF`, color: 'var(--fs-success-700)', sub: 'Paiements reçus' },
                  { label: 'Partenaires', val: `${stats?.nbPartenaires ?? 0}`, color: 'var(--fs-wine-700)', sub: 'Revendeurs enregistrés' },
                ].map(m => (
                  <div key={m.label} style={{ flex: '1 1 200px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{m.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', marginTop: 3 }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                {/* Évolution */}
                <div style={{ flex: '2 1 460px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Évolution (6 mois) — livré vs encaissé</p>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.evolution ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--fs-line)" vertical={false}/>
                        <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--fs-ink-500)' }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fontSize: 10, fill: 'var(--fs-ink-400)' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}/>
                        <Tooltip formatter={(v: number) => `${fmtN(v)} XAF`}/>
                        <Legend wrapperStyle={{ fontSize: 11 }}/>
                        <Bar dataKey="livre" name="Livré" fill={brand} radius={[3, 3, 0, 0]}/>
                        <Bar dataKey="encaisse" name="Encaissé" fill="#15803d" radius={[3, 3, 0, 0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top débiteurs (ventilé par agence) */}
                <div style={{ flex: '1 1 280px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Top débiteurs <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fs-ink-400)' }}>(par agence / commune)</span></p>
                  {(statsAg?.debiteurs ?? []).length === 0 ? (
                    <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune créance — tout est réglé ✓</div>
                  ) : (statsAg?.debiteurs ?? []).slice(0, 10).map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--fs-line)', cursor: 'pointer' }}
                      onClick={() => { setCompteId(d.partenaireId); setTab('comptes'); }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--fs-ink-500)', flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fs-ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.sub}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-danger-700)', flexShrink: 0 }}>{fmtN(d.solde)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Onglet Commandes ── */}
          {tab === 'commandes' && (
            <div style={{ maxWidth: 880 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: editingCmd ? 'var(--fs-wine-700)' : 'var(--fs-ink-900)' }}>{editingCmd ? '✎ Modifier la commande' : 'Nouvelle commande du grossiste'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={LABEL}>Partenaire</label>
                    <select value={cmdPartId} onChange={e => setCmdPartId(e.target.value)} disabled={!!editingCmd} style={{ ...INPUT, cursor: editingCmd ? 'not-allowed' : 'pointer', opacity: editingCmd ? 0.6 : 1 }}>
                      <option value="">— Choisir —</option>
                      {partenaires.map(p => <option key={p._id} value={p._id}>{p.name}{p.lieu ? ` · ${p.lieu}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Mode de paiement</label>
                    <select value={cmdMode} onChange={e => setCmdMode(e.target.value as ModePaiement)} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="comptant">Comptant</option>
                      <option value="credit">Crédit</option>
                      <option value="depot_vente">Dépôt-vente</option>
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Délai (jours)</label>
                    <input type="number" min={0} value={cmdDelai} onChange={e => setCmdDelai(e.target.value)} placeholder="7" style={{ ...INPUT, textAlign: 'center' }}/>
                  </div>
                </div>

                {cmdAgences.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={LABEL}>Agence concernée</label>
                    <select value={cmdAgenceId} onChange={e => setCmdAgenceId(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="">— Aucune (commande au nom du partenaire) —</option>
                      {cmdAgences.map(a => <option key={a._id} value={a._id}>{a.nom}{a.ville ? ` · ${a.ville}` : ''}{a.independante ? ' — indépendante' : ''}</option>)}
                    </select>
                  </div>
                )}

                <label style={LABEL}>Produits commandés (livrés ensuite depuis l'entrepôt)</label>
                {cmdRows.map((row, i) => {
                  const prod = products.find(p => p._id === row.productId);
                  const dp = row.productId ? cmdDernierPrix[row.productId] : undefined;
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 6, alignItems: 'start' }}>
                        <ProductSelect products={products} value={row.productId} onChange={id => setCmdRow(i, { productId: id, prix: row.prix || (cmdDernierPrix[id] ? String(cmdDernierPrix[id]) : '') })}/>
                        <input type="number" min={1} value={row.quantite} onChange={e => setCmdRow(i, { quantite: e.target.value })} placeholder="Qté" style={{ ...INPUT, textAlign: 'center' }}/>
                        <div>
                          <input type="number" min={0} value={row.prix} onChange={e => setCmdRow(i, { prix: e.target.value })} placeholder="Prix" style={{ ...INPUT, textAlign: 'center' }}/>
                          {dp !== undefined && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center', marginTop: 2 }}>dernier : {fmtN(dp)}</div>}
                        </div>
                        <button onClick={() => removeCmdRow(i)} title="Retirer" style={{ padding: '8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I d={D.trash} size={13}/></button>
                      </div>
                      {prod && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 2, paddingLeft: 2 }}>Boutique : <strong>{prod.stock}</strong> · Entrepôt : <strong>{prod.stockMagazin ?? 0}</strong></div>}
                    </div>
                  );
                })}
                <button onClick={addCmdRow} style={{ background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <I d={D.plus} size={13}/> Ajouter une ligne
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--fs-line)' }}>
                  <div style={{ fontSize: 13, color: 'var(--fs-ink-500)' }}>Total estimé : <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(cmdTotal)} XAF</strong></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingCmd && <button onClick={annulerEditionCmd} style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>Annuler</button>}
                    <button onClick={validerCommande} style={BTN_PRIMARY}>{editingCmd ? 'Enregistrer les modifications' : 'Enregistrer la commande'}</button>
                  </div>
                </div>
              </div>

              {/* Liste des commandes */}
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Commandes</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: 'var(--fs-ink-500)', marginBottom: 10 }}>
                <span><span style={{ fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fef9e7', color: '#a16207' }}>Reçue</span> = enregistrée, rien n'est encore livré</span>
                <span><span style={{ fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#eff6ff', color: '#2563eb' }}>Partielle</span> = une partie livrée, les produits en rouge restent à servir</span>
                <span><span style={{ fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a' }}>Livrée</span> = tout est servi (ou clôturée)</span>
              </div>
              {commandes.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune commande</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflowX: 'auto', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--fs-ivory)' }}>
                        <th style={{ padding: '8px 12px' }}>Partenaire / Agence</th>
                        <th style={{ padding: '8px 12px' }}>Produits</th>
                        <th style={{ padding: '8px 12px' }}>Statut</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commandes.map(c => {
                        const tot = c.lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
                        const ag = agenceLabel(c.agence);
                        const statutCfg = c.statut === 'livree' ? { bg: '#f0fdf4', col: '#16a34a', txt: 'Livrée' } : c.statut === 'partielle' ? { bg: '#eff6ff', col: '#2563eb', txt: 'Partielle' } : c.statut === 'preparee' ? { bg: '#eff6ff', col: '#2563eb', txt: 'Préparée' } : { bg: '#fef9e7', col: '#a16207', txt: 'Reçue' };
                        return (
                          <tr key={c._id} style={{ borderTop: '1px solid var(--fs-line)', verticalAlign: 'top' }}>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{typeof c.partenaire === 'object' ? c.partenaire.name : '—'}</div>
                              {ag && <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>{ag}</div>}
                              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{c.numero}{c.delai ? ` · délai ${c.delai}j` : ''}</div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 280 }}>
                                {c.lignes.map((lg, i) => {
                                  const resteLg = Math.max(0, (lg.quantite ?? 0) - (lg.quantiteLivree ?? 0));
                                  const enAttente = c.statut === 'partielle' && resteLg > 0;
                                  return (
                                    <span key={i} title={enAttente ? `${resteLg} sur ${lg.quantite} pas encore servi(s) — c'est pour ça que la commande est « Partielle »` : undefined}
                                      style={{ fontSize: 11, borderRadius: 6, padding: '2px 8px',
                                        background: enAttente ? '#fef2f2' : 'var(--fs-ivory)',
                                        border: enAttente ? '1px solid rgba(194,62,36,0.35)' : '1px solid var(--fs-line)',
                                        color: enAttente ? 'var(--fs-danger-700)' : 'var(--fs-ink-700)',
                                        fontWeight: enAttente ? 700 : 400 }}>
                                      {lg.productName} × <strong>{lg.quantite}</strong>{enAttente && <> · reste {resteLg}</>}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statutCfg.bg, color: statutCfg.col }}>{statutCfg.txt}</span>
                              {c.statut === 'partielle' && (() => {
                                const resteTot = c.lignes.reduce((s, l) => s + Math.max(0, (l.quantite ?? 0) - (l.quantiteLivree ?? 0)), 0);
                                return <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fs-danger-700)', marginTop: 3 }}>{fmtN(resteTot)} article(s) à servir</div>;
                              })()}
                              <div style={{ fontSize: 10, color: 'var(--fs-ink-400)', marginTop: 3 }}>{MODE_LABELS[c.modePaiement]}</div>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtN(tot)}</td>
                            <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--fs-ink-500)', whiteSpace: 'nowrap' }}>{fmtDateTime(c.createdAt)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {c.statut !== 'livree'
                                ? <button onClick={() => setTab('preparer')} title="Préparer / livrer" style={{ padding: '5px 10px', background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Préparer →</button>
                                : <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓</span>}
                              {c.statut === 'partielle' && (
                                confirmClotureId === c._id ? (
                                  <button onClick={() => cloturerCommande(c)} title="Confirmer : le reste ne sera pas livré"
                                    style={{ marginLeft: 6, padding: '5px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Confirmer ?</button>
                                ) : (
                                  <button onClick={() => setConfirmClotureId(c._id)} title="Clôturer : marquer comme livrée même si un reliquat n'a pas été servi (rupture, remplacement…)"
                                    style={{ marginLeft: 6, padding: '5px 10px', background: '#fff', color: '#16a34a', border: '1.5px solid #16a34a', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Clôturer</button>
                                )
                              )}
                              {c.statut === 'recue' && <button onClick={() => chargerCommandePourEdition(c)} title="Modifier la commande" style={{ marginLeft: 6, padding: '5px 8px', background: 'var(--fs-ivory)', color: 'var(--fs-ink-600)', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, cursor: 'pointer', display: 'inline-flex' }}><I d={D.edit} size={13}/></button>}
                              <button onClick={() => imprimerCommande(c)} title="Imprimer le bon de commande" style={{ marginLeft: 6, padding: '5px 8px', background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 7, cursor: 'pointer', display: 'inline-flex' }}><I d={D.print} size={13}/></button>
                              <button onClick={() => supprimerCommande(c)} title={c.statut === 'livree' || c.statut === 'partielle' ? 'Annuler (restitue le stock)' : 'Supprimer'} style={{ marginLeft: 6, padding: '5px 8px', background: '#fef2f2', color: 'var(--fs-danger-700)', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 7, cursor: 'pointer', display: 'inline-flex' }}><I d={D.trash} size={13}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Onglet À préparer (magasinier) ── */}
          {tab === 'preparer' && (
            <div style={{ maxWidth: 880 }}>
              <div style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: 'var(--fs-ink-600)' }}>
                Saisissez les <strong>quantités réellement servies</strong> depuis l'entrepôt. Si vous servez moins que commandé, le <strong>reliquat reste ouvert</strong> et la commande revient ici jusqu'à livraison complète.
              </div>

              {(() => {
                const aPreparer = commandes.filter(c => c.statut === 'recue' || c.statut === 'preparee' || c.statut === 'partielle');
                if (aPreparer.length === 0) return <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune commande à préparer ✓</div>;
                return aPreparer.map(c => {
                  const part = typeof c.partenaire === 'object' ? c.partenaire.name : '—';
                  const ag = agenceLabel(c.agence);
                  const statutCfg = c.statut === 'partielle' ? { bg: '#eff6ff', col: '#2563eb', txt: 'Partielle' } : { bg: '#fef9e7', col: '#a16207', txt: 'Reçue' };
                  const serviDe = (l: typeof c.lignes[number]) => { const kk = `${c._id}|${l.productId}`; const v = prepQty[kk]; return (v !== undefined && v !== '') ? (parseInt(v) || 0) : resteLigne(l); };
                  const stockDe = (l: typeof c.lignes[number]) => products.find(p => p._id === l.productId)?.stockMagazin ?? 0;
                  const enRupture = c.lignes.some(l => serviDe(l) > stockDe(l));
                  return (
                    <div key={c._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: 'var(--fs-shadow-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{part}</span>
                          {ag && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#2563eb' }}>{ag}</span>}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: statutCfg.bg, color: statutCfg.col }}>{statutCfg.txt}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{c.numero} · {fmtDateTime(c.createdAt)}</div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            <th style={{ padding: '5px 6px' }}>Produit</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center' }}>Commandé</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center' }}>Déjà livré</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center' }}>Reste</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center' }}>Entrepôt</th>
                            <th style={{ padding: '5px 6px', textAlign: 'center', width: 110 }}>À servir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.lignes.map((l, i) => {
                            const reste = resteLigne(l);
                            const stockMag = products.find(p => p._id === l.productId)?.stockMagazin ?? 0;
                            const k = `${c._id}|${l.productId}`;
                            const servi = (prepQty[k] !== undefined && prepQty[k] !== '') ? (parseInt(prepQty[k]) || 0) : reste;
                            const over = servi > stockMag;
                            return (
                              <tr key={i} style={{ borderTop: '1px solid var(--fs-line)' }}>
                                <td style={{ padding: '7px 6px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>{l.productName}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)' }}>{l.quantite}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{l.quantiteLivree ?? 0}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: reste > 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>{reste}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center', fontFamily: 'var(--fs-font-mono)', fontWeight: over ? 800 : 400, color: over ? 'var(--fs-danger-700)' : 'var(--fs-ink-500)' }}>{stockMag}</td>
                                <td style={{ padding: '7px 6px', textAlign: 'center' }}>
                                  <input type="number" min={0} max={stockMag} value={prepQty[k] ?? ''} placeholder={String(reste)}
                                    onChange={e => setPrepQty(prev => ({ ...prev, [k]: e.target.value }))}
                                    style={{ ...INPUT, textAlign: 'center', padding: '6px 8px', width: 90, borderColor: over ? 'var(--fs-danger-500)' : 'var(--fs-line-2)', background: over ? '#fef2f2' : '#fff' }}/>
                                  {over && <div style={{ fontSize: 9, color: 'var(--fs-danger-700)', fontWeight: 700, marginTop: 2 }}>max {stockMag}</div>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--fs-line)' }}>
                        {enRupture
                          ? <span style={{ fontSize: 12, color: 'var(--fs-danger-700)', fontWeight: 700 }}>⚠ Stock entrepôt insuffisant — réduisez les quantités à servir</span>
                          : <span style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>Vide = on sert tout le reste</span>}
                        {c.statut === 'partielle' && (
                          confirmClotureId === c._id ? (
                            <button onClick={() => cloturerCommande(c)} title="Confirmer : le reste ne sera pas livré"
                              style={{ padding: '9px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Confirmer la clôture ?</button>
                          ) : (
                            <button onClick={() => setConfirmClotureId(c._id)} title="Le reliquat ne sera jamais servi (rupture, remplacement…) : marquer la commande comme livrée"
                              style={{ padding: '9px 16px', background: '#fff', color: '#16a34a', border: '1.5px solid #16a34a', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>✓ Clôturer sans livrer le reste</button>
                          )
                        )}
                        <button onClick={() => validerPreparation(c)} disabled={prepLoading === c._id || enRupture} style={{ ...BTN_PRIMARY, opacity: (prepLoading === c._id || enRupture) ? 0.5 : 1, cursor: enRupture ? 'not-allowed' : 'pointer' }}>
                          {prepLoading === c._id ? 'Validation…' : 'Valider la livraison'}
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* ── Onglet Livraisons ── */}
          {tab === 'livraisons' && (
            <div style={{ maxWidth: 820 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <label style={LABEL}>Partenaire</label>
                <select value={partId} onChange={e => setPartId(e.target.value)} style={{ ...INPUT, cursor: 'pointer', marginBottom: 14 }}>
                  <option value="">— Choisir un partenaire —</option>
                  {partenaires.map(p => <option key={p._id} value={p._id}>{p.name}{p.lieu ? ` · ${p.lieu}` : ''}</option>)}
                </select>
                {partenaires.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginBottom: 12 }}>
                    Aucun partenaire — créez-en un dans l'onglet « Partenaires ».
                  </div>
                )}

                <label style={LABEL}>Produits livrés (depuis l'entrepôt)</label>
                {rows.map((row, i) => {
                  const dp = row.productId ? dernierPrix[row.productId] : undefined;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 6, marginBottom: 6, alignItems: 'start' }}>
                      <ProductSelect products={warehouse} value={row.productId} onChange={id => setRow(i, { productId: id, prix: row.prix || (dernierPrix[id] ? String(dernierPrix[id]) : '') })}/>
                      <input type="number" min={1} value={row.quantite} onChange={e => setRow(i, { quantite: e.target.value })} placeholder="Qté" style={{ ...INPUT, textAlign: 'center' }}/>
                      <div>
                        <input type="number" min={0} value={row.prix} onChange={e => setRow(i, { prix: e.target.value })} placeholder="Prix" style={{ ...INPUT, textAlign: 'center' }}/>
                        {dp !== undefined && <div style={{ fontSize: 9, color: 'var(--fs-ink-400)', textAlign: 'center', marginTop: 2 }}>dernier : {fmtN(dp)}</div>}
                      </div>
                      <button onClick={() => removeRow(i)} title="Retirer"
                        style={{ padding: '8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, background: '#fff', color: 'var(--fs-danger-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <I d={D.trash} size={13}/>
                      </button>
                    </div>
                  );
                })}
                <button onClick={addRow} style={{ background: '#fff', color: 'var(--fs-wine-700)', border: '1.5px solid var(--fs-wine-700)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <I d={D.plus} size={13}/> Ajouter une ligne
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--fs-line)' }}>
                  <div style={{ width: 150 }}>
                    <label style={LABEL}>Mode de paiement</label>
                    <select value={livMode} onChange={e => setLivMode(e.target.value as ModePaiement)} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="comptant">Comptant</option>
                      <option value="credit">Crédit</option>
                      <option value="depot_vente">Dépôt-vente</option>
                    </select>
                  </div>
                  <div style={{ width: 150 }}>
                    <label style={LABEL}>Montant payé (XAF)</label>
                    <input type="number" min={0} value={montantPaye} onChange={e => setMontantPaye(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Total</span><strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(total)} XAF</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--fs-ink-500)' }}>Reste dû (créance)</span><strong style={{ fontFamily: 'var(--fs-font-mono)', color: creance > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(creance)} XAF</strong></div>
                  </div>
                  <button onClick={validerLivraison} disabled={loadingLiv} style={{ ...BTN_PRIMARY, opacity: loadingLiv ? 0.7 : 1 }}>
                    {loadingLiv ? 'Validation…' : 'Valider la livraison'}
                  </button>
                </div>
              </div>

              {/* Historique des livraisons */}
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-500)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Dernières livraisons</p>
              {livraisons.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune livraison enregistrée</div>
              ) : livraisons.slice(0, 30).map(l => (
                <div key={l._id} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 8, boxShadow: 'var(--fs-shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>
                      {typeof l.partenaire === 'object' ? l.partenaire.name : '—'} · <span style={{ fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-wine-700)' }}>{fmtN(l.total)} XAF</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{l.numeroBL} · {fmtDateTime(l.createdAt)}</div>
                      <button onClick={() => ouvrirEditLivraison(l._id)} title="Modifier cette livraison"
                        style={{ padding: '4px 9px', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✎ Modifier</button>
                      {confirmDelLivId === l._id ? (
                        <button onClick={() => supprimerLivraison(l._id)} title="Confirmer la suppression"
                          style={{ padding: '4px 9px', border: 'none', borderRadius: 7, background: 'var(--fs-danger-700)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Confirmer ?</button>
                      ) : (
                        <button onClick={() => setConfirmDelLivId(l._id)} title="Supprimer (stock restitué à l'entrepôt)"
                          style={{ padding: '4px 9px', border: '1px solid rgba(194,62,36,0.25)', borderRadius: 7, background: '#fef2f2', color: 'var(--fs-danger-700)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {l.lignes.map((lg, i) => (
                      <span key={i} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '3px 8px', color: 'var(--fs-ink-700)' }}>
                        {lg.productName} × {lg.quantite} @ {fmtN(lg.prixUnitaire)}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fs-ink-500)' }}>
                    Payé : {fmtN(l.montantPaye)} XAF · Reste : <strong style={{ color: (l.total - l.montantPaye) > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(Math.max(0, l.total - l.montantPaye))} XAF</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Onglet Comptes & créances ── */}
          {tab === 'comptes' && (
            <div style={{ maxWidth: 860 }}>
              {!compteId ? (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, boxShadow: 'var(--fs-shadow-sm)' }}>
                  ← Sélectionne un partenaire dans la liste à gauche pour voir son détail (agences, dette par agence, versements), ou crée-en un avec « <strong>Nouveau</strong> ».
                </div>
              ) : !compteAg ? (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: 'var(--fs-ink-400)', fontSize: 13, boxShadow: 'var(--fs-shadow-sm)' }}>
                  Chargement du partenaire…
                </div>
              ) : (
                (() => {
                  const nbActives = compteAg.agences.filter(a => !a.archivee).length;
                  const nbIndep = compteAg.agences.filter(a => a.independante && !a.archivee).length;
                  const sub = [
                    compteAg.partenaire.type === 'particulier' ? 'Particulier' : 'Structure',
                    [compteAg.partenaire.ville, compteAg.partenaire.quartier].filter(Boolean).join(' '),
                    compteAg.partenaire.phone, compteAg.partenaire.responsable,
                    nbActives > 0 ? `${nbIndep} agence(s) indépendante(s) / ${nbActives}` : '',
                  ].filter(Boolean).join(' · ');
                  const GHOST = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--fs-ink-700)' } as React.CSSProperties;
                  return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fs-ink-900)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--fs-wine-700)' }}><I d={compteAg.partenaire.type === 'particulier' ? D.user : D.bank} size={20}/></span>
                        {compteAg.partenaire.name}
                      </h1>
                      <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', marginTop: 3 }}>{sub}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => ouvrirEditPartenaire(compteAg.partenaire)} style={GHOST}><I d={D.edit} size={14}/> Modifier</button>
                      <button onClick={() => { if (window.confirm(`Supprimer le partenaire « ${compteAg.partenaire.name} » ?`)) { removePartenaire(compteId); setCompteId(''); setTab('dashboard'); } }} style={{ ...GHOST, color: 'var(--fs-danger-700)', borderColor: 'rgba(194,62,36,0.3)' }}><I d={D.trash} size={14}/> Supprimer</button>
                      <button onClick={() => ouvrirNouvelleAgence(compteAg.partenaire)} style={GHOST}><I d={D.plus} size={14}/> Ajouter une agence</button>
                      {nbActives > 0 && <>
                        <button onClick={() => setToutesAgences(true)} style={GHOST}><I d={D.unlink} size={14}/> Toutes indépendantes</button>
                        <button onClick={() => setToutesAgences(false)} style={GHOST}><I d={D.link} size={14}/> Toutes en commun</button>
                      </>}
                      <button onClick={imprimerReleve} style={GHOST}><I d={D.print} size={14}/> Imprimer</button>
                    </div>
                  </div>
                </div>
                  );
                })()
              )}

              {compteId && compteAg && ((compteAg: CompteAgences) => {
                const indeps = compteAg.agences.filter(a => a.independante);
                const pools = compteAg.agences.filter(a => !a.independante);
                const detteTotale = compteAg.detteAgences + compteAg.detteCommune;
                const indepIds = new Set(indeps.map(a => a._id));
                const versCommuns = compteAg.paiements.filter(p => !p.agence || !indepIds.has(String(p.agence)));
                const livreCommun = compteAg.detteCommune + versCommuns.reduce((s, p) => s + (p.montant ?? 0), 0);
                const CARD: React.CSSProperties = { background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' };
                const rowActions = (a: typeof compteAg.agences[number]) => (
                  <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {a.archivee ? (
                      <button onClick={() => { const f = agences.find(x => x._id === a._id); if (f) reactiverAgence(f); }} style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-600)', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>Réactiver</button>
                    ) : (
                      <>
                        {a.independante && <button onClick={() => setPaieAgenceId(a._id)} title="Verser sur cette agence" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-wine-700)', background: '#fff', border: '1.5px solid var(--fs-wine-700)', borderRadius: 7, padding: '3px 9px', cursor: 'pointer', marginRight: 5 }}>Verser</button>}
                        <button onClick={() => { const f = agences.find(x => x._id === a._id); if (f) toggleIndependante(f); }} title={a.independante ? 'Mettre en dette commune' : 'Rendre indépendante'} style={{ fontSize: 11, fontWeight: 700, color: a.independante ? 'var(--fs-ink-500)' : '#2563eb', background: '#fff', border: `1.5px solid ${a.independante ? 'var(--fs-line-2)' : '#bfdbfe'}`, borderRadius: 7, padding: '3px 9px', cursor: 'pointer' }}>{a.independante ? 'Commune' : 'Indép.'}</button>
                      </>
                    )}
                    <button onClick={() => { const f = agences.find(x => x._id === a._id); if (f) ouvrirEditAgence(f); }} title="Modifier l'agence" style={{ marginLeft: 5, padding: '4px 6px', background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'inline-flex' }}><I d={D.edit} size={12}/></button>
                    <button onClick={() => { const f = agences.find(x => x._id === a._id); if (f) supprimerAgence(f); }} title="Archiver / supprimer" style={{ marginLeft: 5, padding: '4px 6px', background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex' }}><I d={D.trash} size={12}/></button>
                  </td>
                );
                return (
                <>
                  {/* Astuce */}
                  {compteAg.agences.length > 0 && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#1e40af', marginBottom: 16 }}>
                      <strong>Astuce :</strong> le bouton <strong>Indép. / Commune</strong> rend <strong>une seule</strong> agence indépendante (elle règle sa propre dette) ou la remet dans la dette commune. C'est ainsi qu'une agence peut être autonome pendant que les autres restent groupées.
                    </div>
                  )}

                  {/* Totaux */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                    {[
                      { label: 'Total livré', val: compteAg.totalLivre, color: 'var(--fs-ink-900)' },
                      { label: 'Dette commune', val: compteAg.detteCommune, color: 'var(--fs-ink-700)' },
                      { label: 'Dette totale', val: detteTotale, color: 'var(--fs-danger-700)' },
                    ].map(m => (
                      <div key={m.label} style={{ ...CARD, flex: '1 1 180px', marginBottom: 0, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{fmtN(m.val)} <span style={{ fontSize: 12 }}>XAF</span></div>
                      </div>
                    ))}
                  </div>

                  {/* Agences indépendantes */}
                  {indeps.length > 0 && (
                    <div style={CARD}>
                      <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Agences indépendantes <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>— règlent leur propre dette</span></p>
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
                            {indeps.map(a => (
                              <tr key={a._id} style={{ borderTop: '1px solid var(--fs-line)', opacity: a.archivee ? 0.55 : 1 }}>
                                <td style={{ padding: '8px' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{a.nom}{a.archivee ? ' (archivée)' : ''}</div>
                                  <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{a.ville || '—'}</div>
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.qteCommandee)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.livre)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(a.paye + a.verse)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 800, color: a.solde > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(a.solde)}</td>
                                {rowActions(a)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Versement sur agence indépendante */}
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--fs-line)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                        <div style={{ width: 230 }}>
                          <label style={LABEL}>Agence à régler</label>
                          <select value={paieAgenceId} onChange={e => setPaieAgenceId(e.target.value)} style={{ ...INPUT, cursor: 'pointer' }}>
                            <option value="">— Choisir —</option>
                            {indeps.filter(a => !a.archivee).map(a => <option key={a._id} value={a._id}>{a.nom}{a.ville ? ` · ${a.ville}` : ''} — doit {fmtN(a.solde)}</option>)}
                          </select>
                        </div>
                        <div style={{ width: 160 }}>
                          <label style={LABEL}>Montant versé</label>
                          <input type="number" min={0} value={paieMontant} onChange={e => setPaieMontant(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                        </div>
                        <button onClick={enregistrerPaiement} style={{ ...BTN_PRIMARY, opacity: paieAgenceId ? 1 : 0.5 }}><I d={D.compte} size={14}/> Enregistrer le versement</button>
                      </div>
                    </div>
                  )}

                  {/* Dette commune */}
                  {(pools.length > 0 || compteAg.agences.length === 0) && (
                    <div style={CARD}>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Dette commune <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>— avances libres</span></p>
                      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Versements de montants au choix (200 000, 2 M…) qui réduisent la dette commune, sans rapport avec une facture.</p>

                      {(compteAg.ancienneDette ?? 0) > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
                          <span style={{ fontSize: 12, color: '#92400e' }}>Inclut une <strong>ancienne dette</strong> (créance d'avant l'enregistrement) de <strong style={{ fontFamily: 'var(--fs-font-mono)' }}>{fmtN(compteAg.ancienneDette)} XAF</strong> — modifiable via « Modifier ».</span>
                        </div>
                      )}

                      {pools.length > 0 && (
                        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <th style={{ padding: '6px 8px' }}>Agence (suivi)</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qté cmd.</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Livré</th>
                                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pools.map(a => (
                                <tr key={a._id} style={{ borderTop: '1px solid var(--fs-line)', opacity: a.archivee ? 0.55 : 1 }}>
                                  <td style={{ padding: '8px' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{a.nom}{a.archivee ? ' (archivée)' : ''}</div>
                                    <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{a.ville || '—'}</div>
                                  </td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.qteCommandee)}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(a.livre)}</td>
                                  {rowActions(a)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
                        <div style={{ width: 180 }}>
                          <label style={LABEL}>Montant de l'avance</label>
                          <input type="number" min={0} value={montantCommun} onChange={e => setMontantCommun(e.target.value)} placeholder="0" style={{ ...INPUT, textAlign: 'center' }}/>
                        </div>
                        <button onClick={enregistrerVersementCommun} style={BTN_PRIMARY}><I d={D.compte} size={14}/> Enregistrer le versement</button>
                        <div style={{ flex: 1, minWidth: 160, textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dette commune restante</div>
                          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--fs-font-mono)', color: compteAg.detteCommune > 0 ? 'var(--fs-danger-700)' : 'var(--fs-success-700)' }}>{fmtN(compteAg.detteCommune)} XAF</div>
                        </div>
                      </div>

                      {/* Historique des versements communs */}
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
                          {versCommuns.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '10px 8px', color: 'var(--fs-ink-300)' }}>Aucun versement commun</td></tr>
                          ) : (() => {
                            let cumulApres = versCommuns.reduce((s, p) => s + (p.montant ?? 0), 0);
                            return versCommuns.map(p => {
                              const detteApres = Math.max(0, livreCommun - cumulApres);
                              cumulApres -= (p.montant ?? 0);
                              return (
                                <tr key={p._id} style={{ borderTop: '1px solid var(--fs-line)' }}>
                                  <td style={{ padding: '8px' }}>{fmtDateTime(p.createdAt)}</td>
                                  <td style={{ padding: '8px', color: 'var(--fs-ink-500)' }}>Versement{p.note ? ` — ${p.note}` : ''}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(p.montant)}</td>
                                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: 'var(--fs-ink-700)' }}>{fmtN(detteApres)}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
                );
              })(compteAg)}
            </div>
          )}

          {/* ── Onglet Rapport & analyse ── */}
          {tab === 'rapport' && (
            <div style={{ maxWidth: 920 }}>
              {(() => {
                // Top produits livrés
                const prodMap = new Map<string, { q: number; m: number }>();
                for (const l of livraisons) for (const lg of l.lignes) {
                  const e = prodMap.get(lg.productName) ?? { q: 0, m: 0 };
                  e.q += lg.quantite; e.m += lg.quantite * lg.prixUnitaire;
                  prodMap.set(lg.productName, e);
                }
                const topProduits = [...prodMap.entries()].map(([produit, v]) => ({ produit, ...v })).sort((a, b) => b.m - a.m).slice(0, 12);
                // Contribution par partenaire
                const partMap = new Map<string, { name: string; livre: number }>();
                for (const l of livraisons) {
                  const pid = typeof l.partenaire === 'object' ? l.partenaire._id : l.partenaire;
                  const nm = typeof l.partenaire === 'object' ? l.partenaire.name : '—';
                  const e = partMap.get(pid) ?? { name: nm, livre: 0 };
                  e.livre += l.total; partMap.set(pid, e);
                }
                const soldeBy = new Map<string, number>();
                for (const d of (statsAg?.debiteurs ?? [])) soldeBy.set(d.partenaireId, (soldeBy.get(d.partenaireId) ?? 0) + d.solde);
                const totalL = [...partMap.values()].reduce((s, p) => s + p.livre, 0) || 1;
                const contrib = [...partMap.entries()].map(([pid, e]) => { const solde = soldeBy.get(pid) ?? 0; return { name: e.name, livre: e.livre, solde, encaisse: Math.max(0, e.livre - solde), part: e.livre / totalL }; }).sort((a, b) => b.livre - a.livre);
                return (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
                      {[
                        { label: 'Total livré', val: stats?.totalLivre ?? 0, color: 'var(--fs-ink-900)' },
                        { label: 'Total encaissé', val: stats?.totalEncaisse ?? 0, color: 'var(--fs-success-700)' },
                        { label: 'Créances totales', val: stats?.totalCreances ?? 0, color: 'var(--fs-danger-700)' },
                      ].map(m => (
                        <div key={m.label} style={{ flex: '1 1 200px', background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: '14px 18px', boxShadow: 'var(--fs-shadow-sm)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fs-ink-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--fs-font-mono)' }}>{fmtN(m.val)} <span style={{ fontSize: 12 }}>XAF</span></div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Contribution par partenaire</p>
                      {contrib.length === 0 ? <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune livraison enregistrée</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              <th style={{ padding: '6px 8px' }}>Partenaire</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total livré</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Encaissé</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Reste dû</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Part</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contrib.map(c => (
                              <tr key={c.name} style={{ borderTop: '1px solid var(--fs-line)' }}>
                                <td style={{ padding: '8px', fontWeight: 700, color: 'var(--fs-ink-900)' }}>{c.name}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(c.livre)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: 'var(--fs-success-700)' }}>{fmtN(c.encaisse)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', color: c.solde > 0 ? 'var(--fs-danger-700)' : 'var(--fs-ink-400)' }}>{fmtN(c.solde)}</td>
                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                                    <div style={{ width: 60, height: 6, background: 'var(--fs-line)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.round(c.part * 100)}%`, height: '100%', background: 'var(--fs-wine-700)' }}/></div>
                                    <span style={{ fontFamily: 'var(--fs-font-mono)', fontSize: 12 }}>{Math.round(c.part * 100)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Produits les plus livrés</p>
                      {topProduits.length === 0 ? <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun produit livré</div> : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              <th style={{ padding: '6px 8px' }}>Produit</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantité</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topProduits.map(p => (
                              <tr key={p.produit} style={{ borderTop: '1px solid var(--fs-line)' }}>
                                <td style={{ padding: '8px', fontWeight: 600, color: 'var(--fs-ink-900)' }}>{p.produit}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(p.q)}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)' }}>{fmtN(p.m)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ── Onglet Historique ── */}
          {tab === 'historique' && (
            <div style={{ maxWidth: 920 }}>
              <p style={{ fontSize: 12, color: 'var(--fs-ink-400)', margin: '0 0 14px' }}>Toutes les opérations (livraisons, versements, retours), du plus récent au plus ancien.</p>
              {ops.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucune opération</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--fs-ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--fs-ivory)' }}>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Partenaire · Agence</th>
                        <th style={{ padding: '8px 12px' }}>Opération</th>
                        <th style={{ padding: '8px 12px' }}>Détail</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ops.map((o, i) => {
                        const cfg = o.type === 'livraison' ? { bg: '#eff6ff', col: '#2563eb', txt: 'Livraison', sign: '+' } : o.type === 'versement' ? { bg: '#f0fdf4', col: '#16a34a', txt: 'Versement', sign: '−' } : { bg: '#eff6ff', col: '#2563eb', txt: 'Retour', sign: '−' };
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--fs-line)', verticalAlign: 'top' }}>
                            <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--fs-ink-500)' }}>{fmtDateTime(o.date)}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <div style={{ fontWeight: 700, color: 'var(--fs-ink-900)' }}>{o.partenaire}</div>
                              {o.agence && <div style={{ fontSize: 10, color: 'var(--fs-ink-400)' }}>{o.agence}</div>}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: cfg.bg, color: cfg.col }}>{cfg.txt}</span>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              {o.type === 'livraison' && o.lignes ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                  {o.lignes.map((lg, j) => <span key={j} style={{ fontSize: 11, background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 6, padding: '2px 8px', color: 'var(--fs-ink-700)' }}>{lg.productName} × <strong>{lg.quantite}</strong></span>)}
                                </div>
                              ) : <span style={{ fontSize: 12, color: 'var(--fs-ink-500)' }}>{o.note || (o.ref ?? '—')}</span>}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'var(--fs-font-mono)', fontWeight: 700, color: o.type === 'versement' ? 'var(--fs-success-700)' : 'var(--fs-ink-900)', whiteSpace: 'nowrap' }}>
                              {cfg.sign}{fmtN(o.montant)}
                              {o.type === 'livraison' && o.id && (
                                <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 5 }}>
                                  <button onClick={() => ouvrirEditLivraison(o.id!)} title="Modifier cette livraison"
                                    style={{ padding: '3px 8px', border: '1.5px solid var(--fs-line-2)', borderRadius: 6, background: '#fff', color: 'var(--fs-ink-600)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✎</button>
                                  {confirmDelLivId === o.id ? (
                                    <button onClick={() => supprimerLivraison(o.id!)} title="Confirmer la suppression"
                                      style={{ padding: '3px 8px', border: 'none', borderRadius: 6, background: 'var(--fs-danger-700)', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Confirmer ?</button>
                                  ) : (
                                    <button onClick={() => setConfirmDelLivId(o.id!)} title="Supprimer (stock restitué à l'entrepôt)"
                                      style={{ padding: '3px 8px', border: '1px solid rgba(194,62,36,0.25)', borderRadius: 6, background: '#fef2f2', color: 'var(--fs-danger-700)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>🗑</button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Onglet Accès commerciaux (patron) ── */}
          {tab === 'acces' && isPatron && (
            <div style={{ maxWidth: 680 }}>
              <div style={{ background: 'var(--fs-ivory)', border: '1px solid var(--fs-line)', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 12, color: 'var(--fs-ink-600)' }}>
                Un <strong>compte Partenaires</strong> est un identifiant de connexion <strong>propre à cet espace</strong> : la personne se connecte avec son email + mot de passe et arrive <strong>directement</strong> sur l'espace Partenaires (sans passer par l'admin, et sans voir la caisse ni l'entrepôt).
              </div>

              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>Nouveau compte de connexion Partenaires</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={LABEL}>Nom</label><input value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} style={INPUT} placeholder="ex : Gérant partenaires"/></div>
                  <div><label style={LABEL}>Email (identifiant)</label><input value={accForm.email} onChange={e => setAccForm(f => ({ ...f, email: e.target.value }))} style={INPUT} placeholder="partenaires@familystore.cm"/></div>
                  <div><label style={LABEL}>Mot de passe</label><input value={accForm.password} onChange={e => setAccForm(f => ({ ...f, password: e.target.value }))} style={INPUT} placeholder="≥ 4 caractères"/></div>
                </div>
                <button onClick={creerCommercial} style={BTN_PRIMARY}>Créer le compte</button>
              </div>

              {commerciaux.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun compte de connexion Partenaires</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  {commerciaux.map((u, i) => (
                    <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < commerciaux.length - 1 ? '1px solid var(--fs-line)' : 'none', background: i % 2 ? 'var(--fs-ivory)' : '#fff' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{u.email}</div>
                      </div>
                      <button onClick={() => resetPassword(u._id)} title="Réinitialiser le mot de passe"
                        style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--fs-ink-600)', fontSize: 12, fontWeight: 600 }}>Mot de passe</button>
                      <button onClick={() => supprimerCommercial(u._id)} title="Supprimer"
                        style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex' }}><I d={D.trash} size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Onglet Partenaires ── */}
          {tab === 'partenaires' && (
            <div style={{ maxWidth: 760 }}>
              <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, padding: 20, marginBottom: 18, boxShadow: 'var(--fs-shadow-sm)' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)' }}>{editing ? 'Modifier le partenaire' : "Fiche d'inscription — nouveau partenaire"}</p>
                <p style={{ margin: '0 0 14px', fontSize: 11.5, color: 'var(--fs-ink-400)' }}>Les <strong>agences</strong> s'ajoutent ensuite sur la fiche (bouton « Agences »). Un partenaire peut démarrer sans agence.</p>

                <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Identité</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={LABEL}>Nom / raison sociale *</label><input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} style={INPUT} placeholder="ex : Santa Lucia"/></div>
                  <div><label style={LABEL}>Type</label>
                    <select value={pForm.type} onChange={e => setPForm(f => ({ ...f, type: e.target.value as 'structure' | 'particulier' }))} style={{ ...INPUT, cursor: 'pointer' }}>
                      <option value="structure">Structure (entreprise)</option>
                      <option value="particulier">Particulier (revendeur)</option>
                    </select>
                  </div>
                </div>

                <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Coordonnées</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div><label style={LABEL}>Responsable / contact</label><input value={pForm.responsable} onChange={e => setPForm(f => ({ ...f, responsable: e.target.value }))} style={INPUT} placeholder="Nom du responsable"/></div>
                  <div><label style={LABEL}>Téléphone</label><input value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} style={INPUT} placeholder="6XX XX XX XX"/></div>
                  <div><label style={LABEL}>Ville</label><input value={pForm.ville} onChange={e => setPForm(f => ({ ...f, ville: e.target.value }))} style={INPUT} placeholder="ex : Douala"/></div>
                  <div><label style={LABEL}>Quartier / zone</label><input value={pForm.quartier} onChange={e => setPForm(f => ({ ...f, quartier: e.target.value }))} style={INPUT} placeholder="ex : Akwa, Bonabéri…"/></div>
                  <div><label style={LABEL}>Email</label><input value={pForm.email} onChange={e => setPForm(f => ({ ...f, email: e.target.value }))} style={INPUT} placeholder="contact@exemple.cm"/></div>
                  <div><label style={LABEL}>Note</label><input value={pForm.note} onChange={e => setPForm(f => ({ ...f, note: e.target.value }))} style={INPUT} placeholder="(optionnel)"/></div>
                </div>

                <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Ancienne dette (report)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 12, alignItems: 'end' }}>
                  <div><label style={LABEL}>Montant (XAF)</label><input type="number" min={0} value={pForm.ancienneDette} onChange={e => setPForm(f => ({ ...f, ancienneDette: e.target.value }))} style={INPUT} placeholder="0"/></div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--fs-ink-400)', lineHeight: 1.45 }}>Créance que le partenaire devait <strong>avant</strong> son enregistrement ici. Elle s'ajoute à sa dette commune et les versements la réduisent normalement.</p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={savePartenaire} style={BTN_PRIMARY}>{editing ? 'Enregistrer' : 'Inscrire le partenaire'}</button>
                  {editing && <button onClick={() => { setEditing(null); setPForm({ ...PFORM_VIDE }); }} style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>Annuler</button>}
                </div>
              </div>

              {partenaires.length === 0 ? (
                <div style={{ color: 'var(--fs-ink-300)', fontSize: 13 }}>Aucun partenaire pour l'instant</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--fs-shadow-sm)' }}>
                  {partenaires.map((p, i) => {
                    const localisation = [p.ville, p.quartier].filter(Boolean).join(' · ') || p.lieu || '';
                    const ouvert = agencesPartId === p._id;
                    return (
                      <div key={p._id} style={{ borderBottom: i < partenaires.length - 1 ? '1px solid var(--fs-line)' : 'none', background: ouvert ? 'var(--fs-ivory)' : (i % 2 ? 'var(--fs-ivory)' : '#fff') }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fs-ink-900)', display: 'flex', alignItems: 'center', gap: 7 }}>
                              {p.name}
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 8, background: p.type === 'particulier' ? '#f0fdf4' : '#eff6ff', color: p.type === 'particulier' ? '#16a34a' : '#2563eb' }}>{p.type === 'particulier' ? 'Particulier' : 'Structure'}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--fs-ink-400)' }}>{[localisation, p.responsable, p.phone].filter(Boolean).join(' · ') || '—'}</div>
                          </div>
                          <button onClick={() => ouvert ? setAgencesPartId(null) : ouvrirAgences(p._id)} title="Gérer les agences"
                            style={{ background: ouvert ? 'var(--fs-wine-700)' : 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: ouvert ? '#fff' : 'var(--fs-ink-600)', fontSize: 12, fontWeight: 700 }}>
                            Agences
                          </button>
                          <button onClick={() => { setCompteId(p._id); setTab('comptes'); }} title="Voir le compte / créance"
                            style={{ background: 'var(--fs-wine-50)', border: '1px solid var(--fs-wine-200)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--fs-wine-700)', fontSize: 12, fontWeight: 700 }}>
                            Compte
                          </button>
                          <button onClick={() => { setEditing(p._id); setPForm({ name: p.name, phone: p.phone, ville: p.ville ?? '', quartier: p.quartier ?? '', responsable: p.responsable ?? '', email: p.email ?? '', note: p.note, type: p.type ?? 'structure', ancienneDette: p.ancienneDette ? String(p.ancienneDette) : '' }); window.scrollTo(0, 0); }} title="Modifier"
                            style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'inline-flex' }}><I d={D.edit} size={13}/></button>
                          <button onClick={() => removePartenaire(p._id)} title="Supprimer"
                            style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex' }}><I d={D.trash} size={13}/></button>
                        </div>

                        {/* Panneau de gestion des agences */}
                        {ouvert && (
                          <div style={{ padding: '0 16px 16px' }}>
                            <div style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 10, padding: 14 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fs-ink-700)' }}>Agences de {p.name}</span>
                                <button onClick={() => ouvrirNouvelleAgence(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--fs-wine-700)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}><I d={D.plus} size={12}/> Ajouter une agence</button>
                              </div>

                              {agences.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--fs-ink-400)', padding: '6px 0' }}>Aucune agence — ce partenaire fonctionne en compte unique. Ajoutez-en une si besoin.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {agences.map(a => (
                                    <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--fs-line)', borderRadius: 8, background: a.archivee ? '#fafafa' : '#fff' }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: a.archivee ? 'var(--fs-ink-400)' : 'var(--fs-ink-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                          {a.nom}
                                          {a.independante && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#eff6ff', color: '#2563eb' }}>Indépendante</span>}
                                          {a.archivee && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', color: '#6b7280' }}>Archivée</span>}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: 'var(--fs-ink-400)' }}>{[a.ville, a.quartier, a.responsable, a.telephone].filter(Boolean).join(' · ') || '—'}</div>
                                      </div>
                                      <button onClick={() => toggleIndependante(a)} title={a.independante ? 'Mettre en dette commune' : 'Rendre indépendante (règle sa propre dette)'}
                                        style={{ fontSize: 11, fontWeight: 700, color: a.independante ? 'var(--fs-ink-500)' : '#2563eb', background: '#fff', border: `1.5px solid ${a.independante ? 'var(--fs-line-2)' : '#bfdbfe'}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
                                        {a.independante ? 'Dette commune' : 'Rendre indép.'}
                                      </button>
                                      {a.archivee && <button onClick={() => reactiverAgence(a)} title="Réactiver" style={{ fontSize: 11, fontWeight: 700, color: 'var(--fs-ink-600)', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, padding: '4px 8px', cursor: 'pointer' }}>Réactiver</button>}
                                      <button onClick={() => ouvrirEditAgence(a)} title="Modifier" style={{ background: 'var(--fs-ivory)', border: '1.5px solid var(--fs-line-2)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--fs-ink-600)', display: 'inline-flex' }}><I d={D.edit} size={12}/></button>
                                      <button onClick={() => supprimerAgence(a)} title="Archiver / supprimer" style={{ background: '#fef2f2', border: '1px solid rgba(194,62,36,0.2)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: 'var(--fs-danger-700)', display: 'inline-flex' }}><I d={D.trash} size={12}/></button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal fiche d'inscription partenaire */}
      {showPartModal && (
        <div onClick={() => setShowPartModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, boxShadow: 'var(--fs-shadow-md)', width: 560, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            <p style={{ margin: '0 0 2px', fontSize: 17, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{editing ? 'Modifier le partenaire' : "Fiche d'inscription — nouveau partenaire"}</p>
            <p style={{ margin: '0 0 18px', fontSize: 12, color: 'var(--fs-ink-400)' }}>Les <strong>agences</strong> s'ajoutent ensuite sur la fiche du partenaire. Un partenaire peut démarrer sans agence.</p>

            <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Identité</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={LABEL}>Nom / raison sociale *</label><input value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} style={INPUT} placeholder="ex : Santa Lucia" autoFocus/></div>
              <div><label style={LABEL}>Type</label>
                <select value={pForm.type} onChange={e => setPForm(f => ({ ...f, type: e.target.value as 'structure' | 'particulier' }))} style={{ ...INPUT, cursor: 'pointer' }}>
                  <option value="structure">Structure (entreprise)</option>
                  <option value="particulier">Particulier (revendeur)</option>
                </select>
              </div>
            </div>

            <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label style={LABEL}>Responsable / contact</label><input value={pForm.responsable} onChange={e => setPForm(f => ({ ...f, responsable: e.target.value }))} style={INPUT} placeholder="Nom du responsable"/></div>
              <div><label style={LABEL}>Téléphone</label><input value={pForm.phone} onChange={e => setPForm(f => ({ ...f, phone: e.target.value }))} style={INPUT} placeholder="6XX XX XX XX"/></div>
              <div><label style={LABEL}>Ville</label><input value={pForm.ville} onChange={e => setPForm(f => ({ ...f, ville: e.target.value }))} style={INPUT} placeholder="ex : Douala"/></div>
              <div><label style={LABEL}>Quartier / zone</label><input value={pForm.quartier} onChange={e => setPForm(f => ({ ...f, quartier: e.target.value }))} style={INPUT} placeholder="ex : Akwa, Bonabéri…"/></div>
              <div><label style={LABEL}>Email</label><input value={pForm.email} onChange={e => setPForm(f => ({ ...f, email: e.target.value }))} style={INPUT} placeholder="contact@exemple.cm"/></div>
              <div><label style={LABEL}>Note</label><input value={pForm.note} onChange={e => setPForm(f => ({ ...f, note: e.target.value }))} style={INPUT} placeholder="(optionnel)"/></div>
            </div>

            <p style={{ ...LABEL, color: 'var(--fs-wine-700)', marginBottom: 8 }}>Ancienne dette (report)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16, alignItems: 'end' }}>
              <div><label style={LABEL}>Montant (XAF)</label><input type="number" min={0} value={pForm.ancienneDette} onChange={e => setPForm(f => ({ ...f, ancienneDette: e.target.value }))} style={INPUT} placeholder="0"/></div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--fs-ink-400)', lineHeight: 1.45 }}>Créance que le partenaire devait <strong>avant</strong> son enregistrement ici. Elle s'ajoute à sa dette commune et les versements la réduisent normalement.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowPartModal(false)} style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>Annuler</button>
              <button onClick={savePartenaire} style={{ ...BTN_PRIMARY, opacity: pForm.name.trim() ? 1 : 0.5 }}>{editing ? 'Enregistrer' : 'Inscrire le partenaire'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fiche d'agence */}
      {aForm && (
        <div onClick={() => setAForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', border: '1px solid var(--fs-line)', borderRadius: 12, boxShadow: 'var(--fs-shadow-md)', width: 520, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            <p style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800, color: 'var(--fs-ink-900)' }}>{aForm.id ? "Modifier l'agence" : 'Nouvelle agence'}</p>
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL}>Nom de l'agence *</label>
              <input value={aForm.nom} onChange={e => setAForm(f => f && ({ ...f, nom: e.target.value }))} placeholder="ex : Agence Akwa" style={INPUT} autoFocus/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={LABEL}>Ville</label><input value={aForm.ville} onChange={e => setAForm(f => f && ({ ...f, ville: e.target.value }))} placeholder="ex : Douala" style={INPUT}/></div>
              <div><label style={LABEL}>Zone / quartier</label><input value={aForm.quartier} onChange={e => setAForm(f => f && ({ ...f, quartier: e.target.value }))} placeholder="ex : Akwa, Bonabéri…" style={INPUT}/></div>
              <div><label style={LABEL}>Téléphone</label><input value={aForm.telephone} onChange={e => setAForm(f => f && ({ ...f, telephone: e.target.value }))} placeholder="6XX XX XX XX" style={INPUT}/></div>
              <div><label style={LABEL}>Responsable</label><input value={aForm.responsable} onChange={e => setAForm(f => f && ({ ...f, responsable: e.target.value }))} placeholder="Nom du responsable" style={INPUT}/></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--fs-line-2)', marginBottom: 18 }}>
              <input type="checkbox" checked={aForm.independante} onChange={e => setAForm(f => f && ({ ...f, independante: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }}/>
              <span style={{ fontSize: 13, color: 'var(--fs-ink-700)' }}><strong>Règle sa propre dette</strong> (indépendante) — sinon elle entre dans la dette commune du partenaire.</span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAForm(null)} style={{ padding: '9px 18px', background: '#fff', border: '1.5px solid var(--fs-line-2)', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--fs-ink-500)' }}>Annuler</button>
              <button onClick={saveAgence} style={{ ...BTN_PRIMARY, opacity: aForm.nom.trim() ? 1 : 0.5 }}>{aForm.id ? 'Enregistrer' : "Ajouter l'agence"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
