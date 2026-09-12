/**
 * Comptoir — poste de vente du profil Snack-bar.
 *
 * Version RÉDUITE du mode grille de la caisse commerce, pensée pour une
 * tablette en plein soleil et un vendeur debout : pas de code-barres, pas de
 * recherche clavier, de grosses cases, un encaissement en deux taps (mode de
 * paiement → « Encaisser »), ticket sur demande.
 *
 * Ce que l'écran réutilise par IMPORT (rien n'est copié) : `createSale` et le
 * catalogue (`api/products`), la file hors-ligne (`services/offlineSync`), le
 * ticket (`components/ReceiptPrint`), les sessions, les paramètres.
 *
 * Consignes : une bouteille consignée ajoute une ligne « Consigne … » à la
 * vente (règles dans `utils/comptoir-panier.ts`). Le retour de vide rembourse par une
 * dépense côté serveur (`retournerVides`) — jamais une ligne négative.
 *
 * Boisson vendue AU VERRE : le stock d'un produit est vérifié à la vente en
 * bouteilles. Pour vendre au verre, créer un produit « … (verre) » à part,
 * avec son propre stock (ou sans suivi) ; la bouteille reste comptée en
 * bouteilles. Ce choix est rappelé dans l'écran (panier vide).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllProducts, createSale, Product, SaleError, effectivePrice } from '../api/products';
import { openSession, getActiveSession } from '../api/sessions';
import { getTokenPayload } from '../api/dashboard';
import ToastContainer, { useToast } from '../components/Toast';
import { buildReceiptHTML, doPrint, getPrintSettings, ReceiptData } from '../components/ReceiptPrint';
import {
  cacheProducts, getCachedProducts, savePendingSale, getPendingSales, syncPendingSales, decrementCachedStock,
} from '../services/offlineSync';
import { idbLire, idbEcrire } from '../services/storage';
import { deconnexion } from '../services/session';
import { useSettings } from '../contexts/SettingsContext';
import { storeIdentity } from '../api/settings';
import { nomEnseigne } from '../config/marque';
import { displayName } from '../utils/text';
import { uniteAffichee } from '../utils/unites';
import { useIsMobile } from '../hooks/useIsMobile';
import { t, dateLocale } from '../i18n';
import { ConditionnementSnack, getConditionnements, retournerVides } from '../api/comptoir';
import {
  LignePanier, ModePaiementComptoir, MODES_PAIEMENT_COMPTOIR, PREFIXE_LIGNE_CONSIGNE,
  carteConsignes, ajouterAuPanier, changerQuantite, basculerConsigne, totauxPanier, chargeDeVente, categoriesDuCatalogue,
} from '../utils/comptoir-panier';

const CLE_CACHE_CONDITIONNEMENTS = 'snack_conditionnements';

const fmt = (n: number) => `${n.toLocaleString(dateLocale())} F`;

const nouvelleCle = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Couleurs pastel par catégorie (clé en minuscules) — lisibles au soleil.
const COULEURS: Record<string, string> = {
  'bières': '#F3D9A4', 'bieres': '#F3D9A4', 'beers': '#F3D9A4',
  'sodas': '#F5C4B2', 'eaux': '#B8D8EC', 'water': '#B8D8EC',
  'snacks': '#D8C4E8', 'plats': '#B4DCC4', 'vins': '#E3B8C8', 'spiritueux': '#D4C8B8',
};
const couleurCarte = (cat?: string) => COULEURS[(cat ?? '').toLowerCase()] ?? '#DDD4C8';

// ── Écran ─────────────────────────────────────────────────────────────────────

export default function Comptoir() {
  const { settings } = useSettings();
  const isMobile = useIsMobile(900);
  const { toasts, addToast, removeToast } = useToast();
  const jeton = useMemo(() => getTokenPayload(), []);
  const nomVendeur = jeton?.name ?? t('Vendeur', 'Seller');

  const [produits, setProduits]   = useState<Product[]>([]);
  const [conds, setConds]         = useState<ConditionnementSnack[]>([]);
  const [chargement, setChargement] = useState(true);
  const [categorie, setCategorie] = useState<string>('');
  const [panier, setPanier]       = useState<LignePanier[]>([]);
  const [mode, setMode]           = useState<ModePaiementComptoir>('cash');
  const [remis, setRemis]         = useState<string>('');
  const [encaissement, setEncaissement] = useState(false);
  const [dernierTicket, setDernierTicket] = useState<ReceiptData | null>(null);
  const [enAttente, setEnAttente] = useState(0);
  const [horsLigne, setHorsLigne] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [modalRetour, setModalRetour] = useState(false);

  const consignes  = useMemo(() => carteConsignes(conds), [conds]);
  const categories = useMemo(() => categoriesDuCatalogue(produits), [produits]);
  const totaux     = useMemo(() => totauxPanier(panier, consignes), [panier, consignes]);
  const visibles   = useMemo(
    () => produits.filter(p => !categorie || (p.category ?? '').trim() === categorie),
    [produits, categorie],
  );
  const montantRemis = Number(remis.replace(/\s/g, '')) || 0;
  const monnaie = mode === 'cash' && montantRemis > 0 ? Math.max(0, montantRemis - totaux.total) : 0;

  // ── Chargement du catalogue (en ligne : serveur puis cache ; hors ligne : cache) ──
  const charger = useCallback(async () => {
    setChargement(true);
    try {
      if (navigator.onLine) {
        const [ps, cs] = await Promise.all([getAllProducts(), getConditionnements()]);
        setProduits(ps); setConds(cs);
        await cacheProducts(ps);
        await idbEcrire(CLE_CACHE_CONDITIONNEMENTS, cs);
      } else {
        setProduits(await getCachedProducts());
        setConds((await idbLire<ConditionnementSnack[]>(CLE_CACHE_CONDITIONNEMENTS)) ?? []);
      }
    } catch {
      // Serveur injoignable : on sert le cache, la vente continue.
      setProduits(await getCachedProducts().catch(() => []));
      setConds((await idbLire<ConditionnementSnack[]>(CLE_CACHE_CONDITIONNEMENTS).catch(() => undefined)) ?? []);
    } finally {
      setChargement(false);
    }
    setEnAttente((await getPendingSales().catch(() => [])).length);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  // Session de travail (comptage des ventes) — jamais bloquante.
  useEffect(() => {
    if (!navigator.onLine) return;
    getActiveSession().then(s => s ?? openSession()).then(s => setSessionId(s?._id)).catch(() => {});
  }, []);

  // Retour du réseau : on vide la file puis on recharge le catalogue.
  useEffect(() => {
    const enLigne = async () => {
      setHorsLigne(false);
      await syncPendingSales(addToast).catch(() => {});
      await charger();
    };
    const horsLigneH = () => setHorsLigne(true);
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsLigneH);
    return () => { window.removeEventListener('online', enLigne); window.removeEventListener('offline', horsLigneH); };
  }, [addToast, charger]);

  // ── Panier ────────────────────────────────────────────────────────────────
  const ajouter = (p: Product) => setPanier(prev => ajouterAuPanier(prev, p, consignes));
  const plusMoins = (id: string, delta: number) => setPanier(prev => changerQuantite(prev, id, delta));
  const viderPanier = () => { setPanier([]); setRemis(''); setMode('cash'); };

  const stockLocalApresVente = (lignes: LignePanier[]) =>
    setProduits(prev => prev.map(p => {
      const l = lignes.find(x => x.product._id === p._id);
      return l ? { ...p, stock: p.stock - l.quantity } : p;
    }));

  // ── Encaissement ──────────────────────────────────────────────────────────
  const construireTicket = (numero: string, date: Date, total: number, paye: number, rendu: number): ReceiptData => {
    const libelle = MODES_PAIEMENT_COMPTOIR.find(m => m.value === mode)?.label ?? mode;
    const items: ReceiptData['items'] = [];
    for (const l of panier) {
      items.push({ name: l.product.name, unit: l.product.unit, valeur: l.product.valeur || undefined, quantity: l.quantity, unitPrice: effectivePrice(l.product) });
      const c = consignes[l.product._id] ?? 0;
      if (l.consigne && c > 0) items.push({ name: `${PREFIXE_LIGNE_CONSIGNE}${displayName(l.product.name)}`, unit: '', quantity: l.quantity, unitPrice: c });
    }
    return {
      receiptNo: numero, date, cashierName: nomVendeur, storePhone: settings.telephone || undefined,
      store: storeIdentity(settings), items, subtotal: total, total, paymentLabel: libelle,
      amountPaid: paye, change: rendu, offre: settings.offreFacture,
    };
  };

  const finDeVente = (ticket: ReceiptData, lignes: LignePanier[]) => {
    stockLocalApresVente(lignes);
    setDernierTicket(ticket);
    viderPanier();
    const ps = getPrintSettings();
    if (ps.auto) doPrint(buildReceiptHTML(ticket), ps.copies);
  };

  const encaisser = async () => {
    if (panier.length === 0 || encaissement) return;
    if (mode === 'cash' && montantRemis > 0 && montantRemis < totaux.total) {
      addToast(t('Montant remis insuffisant', 'Amount given is not enough'), 'warning');
      return;
    }
    setEncaissement(true);
    const lignes = [...panier];
    const charge = chargeDeVente(panier, consignes, { mode, montantRemis: montantRemis || undefined }, nouvelleCle(), sessionId);
    const libelle = MODES_PAIEMENT_COMPTOIR.find(m => m.value === mode)?.label ?? mode;
    const d = new Date();
    const dateP = d.toISOString().slice(0, 10).replace(/-/g, '');

    const horsLigneEnregistrer = async (message: string) => {
      await savePendingSale({
        items: charge.items, total: charge.total, subtotal: charge.total, cashierName: nomVendeur,
        paymentLabel: libelle, paymentMethod: charge.paymentMethod, amountPaid: charge.amountPaid, idempotencyKey: charge.idempotencyKey,
      });
      for (const l of lignes) await decrementCachedStock(l.product._id, l.quantity);
      setEnAttente(n => n + 1);
      addToast(message, 'warning');
      finDeVente(construireTicket(`OFF-${dateP}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, d, charge.total, charge.amountPaid, Math.max(0, charge.amountPaid - charge.total)), lignes);
    };

    try {
      if (!navigator.onLine) {
        await horsLigneEnregistrer(t('Hors ligne — vente gardée, envoyée dès le retour du réseau', 'Offline — sale kept, sent when the network is back'));
        return;
      }
      try {
        const r = await createSale(charge);
        finDeVente(construireTicket(`FSV-${dateP}-${String(r.sale._id).slice(-6).toUpperCase()}`, d, charge.total, charge.amountPaid, r.change), lignes);
        for (const a of r.alerts) {
          addToast(a.stock <= 0 ? t(`Rupture — ${displayName(a.productName)}`, `Out of stock — ${displayName(a.productName)}`)
                                : t(`Stock bas — ${displayName(a.productName)} : ${a.stock}`, `Low stock — ${displayName(a.productName)}: ${a.stock}`), 'warning');
        }
      } catch (err) {
        const kind = err instanceof SaleError ? err.kind : 'unknown';
        const msg  = err instanceof Error ? err.message : t("Erreur d'enregistrement", 'Save error');
        if (kind === 'auth') {
          await savePendingSale({ items: charge.items, total: charge.total, subtotal: charge.total, cashierName: nomVendeur, paymentLabel: libelle, paymentMethod: charge.paymentMethod, amountPaid: charge.amountPaid, idempotencyKey: charge.idempotencyKey }).catch(() => {});
          addToast(t('Session expirée — vente gardée localement', 'Session expired — sale kept locally'), 'warning');
          setTimeout(() => { void deconnexion().then(ok => { if (ok) window.location.href = '/login'; }); }, 1800);
        } else if (kind === 'stock') {
          addToast(msg, 'error');
        } else {
          await horsLigneEnregistrer(t('Réseau indisponible — vente gardée, envoyée plus tard', 'Network unavailable — sale kept, sent later'));
        }
      }
    } catch {
      addToast(t("Échec — impossible d'enregistrer la vente", 'Failure — unable to save the sale'), 'error');
    } finally {
      setEncaissement(false);
    }
  };

  const imprimerDernier = () => {
    if (!dernierTicket) return;
    doPrint(buildReceiptHTML(dernierTicket), getPrintSettings().copies);
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  const produitsConsignes = useMemo(() => produits.filter(p => (consignes[p._id] ?? 0) > 0), [produits, consignes]);

  return (
    <div data-testid="comptoir" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FAF7F2', color: 'var(--fs-ink-900)', fontFamily: 'var(--fs-font-sans, system-ui)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* En-tête */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--fs-wine-700)', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '0.02em' }}>{nomEnseigne(settings.nomMagasin)}</div>
        <div style={{ opacity: 0.85, fontSize: 14 }}>· {t('Comptoir', 'Counter')} · {nomVendeur}</div>
        <div style={{ flex: 1 }} />
        {horsLigne && <span data-testid="badge-hors-ligne" style={badge('#C23E24')}>{t('HORS LIGNE', 'OFFLINE')}</span>}
        {enAttente > 0 && <span data-testid="badge-attente" style={badge('#B8893E')}>{t(`${enAttente} à envoyer`, `${enAttente} to send`)}</span>}
        <button type="button" data-testid="btn-retour-vide" onClick={() => setModalRetour(true)} style={boutonEntete}>
          ↩ {t('Retour de vide', 'Empties return')}
        </button>
        <button type="button" data-testid="btn-ticket" onClick={imprimerDernier} disabled={!dernierTicket} style={{ ...boutonEntete, opacity: dernierTicket ? 1 : 0.4 }}>
          🧾 {t('Ticket', 'Receipt')}
        </button>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Grille */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <nav data-testid="categories" style={{ display: 'flex', gap: 8, padding: 12, overflowX: 'auto', flexShrink: 0 }}>
            <Puce actif={categorie === ''} onClick={() => setCategorie('')}>{t('Tout', 'All')}</Puce>
            {categories.map(c => <Puce key={c} actif={categorie === c} onClick={() => setCategorie(c)}>{displayName(c)}</Puce>)}
          </nav>
          <div data-testid="grille" style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', display: 'grid', gap: 10, alignContent: 'start',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {chargement && <div style={{ gridColumn: '1 / -1', padding: 24, color: 'var(--fs-ink-500)' }}>{t('Chargement du catalogue…', 'Loading catalogue…')}</div>}
            {!chargement && visibles.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 24, color: 'var(--fs-ink-500)' }}>
                {t('Aucun produit dans cette catégorie.', 'No product in this category.')}
              </div>
            )}
            {visibles.map(p => <Carte key={p._id} produit={p} consigne={consignes[p._id] ?? 0} onClick={() => ajouter(p)} />)}
          </div>
        </section>

        {/* Panier + encaissement */}
        <aside data-testid="panier" style={{ width: isMobile ? '100%' : 360, borderLeft: '1px solid #E6DED5', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, maxHeight: isMobile ? '55vh' : undefined }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {panier.length === 0 ? (
              <div style={{ color: 'var(--fs-ink-400)', fontSize: 14, lineHeight: 1.5, padding: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fs-ink-500)', marginBottom: 8 }}>{t('Touchez un produit pour commencer', 'Tap a product to start')}</div>
                {dernierTicket && (
                  <div data-testid="derniere-vente" style={{ background: '#EEF7F1', borderRadius: 8, padding: 10, marginBottom: 10, color: 'var(--fs-ink-700)' }}>
                    {t('Dernière vente', 'Last sale')} : <b>{fmt(dernierTicket.total)}</b>
                    {dernierTicket.change > 0 && <> · {t('à rendre', 'change')} <b>{fmt(dernierTicket.change)}</b></>}
                  </div>
                )}
                <div style={{ fontSize: 12 }}>
                  {t('Boisson vendue au verre : créez un produit « … (verre) » à part, avec son propre stock. La bouteille reste comptée en bouteilles.',
                     'Drink sold by the glass: create a separate “… (glass)” product with its own stock. The bottle stays counted in bottles.')}
                </div>
              </div>
            ) : panier.map(l => {
              const c = consignes[l.product._id] ?? 0;
              return (
                <div key={l.product._id} data-testid="ligne-panier" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: '1px solid #F0EAE2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{displayName(l.product.name)}</div>
                    <div style={{ fontFamily: 'var(--fs-font-mono)', fontSize: 14 }}>{fmt(effectivePrice(l.product) * l.quantity)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" aria-label={t('Moins', 'Less')} onClick={() => plusMoins(l.product._id, -1)} style={boutonQte}>−</button>
                    <span data-testid="qte" style={{ minWidth: 28, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{l.quantity}</span>
                    <button type="button" aria-label={t('Plus', 'More')} onClick={() => plusMoins(l.product._id, +1)} style={boutonQte}>+</button>
                    <span style={{ fontSize: 12, color: 'var(--fs-ink-400)' }}>{fmt(effectivePrice(l.product))} / {uniteAffichee(l.product.unit) || t('pce', 'pc')}</span>
                    <div style={{ flex: 1 }} />
                    {c > 0 && (
                      <button type="button" data-testid="btn-consigne" onClick={() => setPanier(prev => basculerConsigne(prev, l.product._id))}
                        style={{ ...puce(l.consigne), fontSize: 12, padding: '4px 8px', minHeight: 32 }}>
                        {l.consigne ? `${t('Consigne', 'Deposit')} +${fmt(c * l.quantity)}` : t('Sans consigne', 'No deposit')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '2px solid #E6DED5', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {totaux.consignes > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--fs-ink-500)' }}>
                <span>{t('Articles', 'Items')}</span><span data-testid="total-articles">{fmt(totaux.articles)}</span>
              </div>
            )}
            {totaux.consignes > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--fs-ink-500)' }}>
                <span>{t(`Consignes (${totaux.nbConsignes})`, `Deposits (${totaux.nbConsignes})`)}</span><span data-testid="total-consignes">{fmt(totaux.consignes)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 800, fontSize: 16 }}>{t('Total', 'Total')}</span>
              <span data-testid="total" style={{ fontWeight: 900, fontSize: 28, fontFamily: 'var(--fs-font-mono)' }}>{fmt(totaux.total)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {MODES_PAIEMENT_COMPTOIR.map(m => (
                <button key={m.value} type="button" data-testid={`mode-${m.value}`} onClick={() => setMode(m.value)}
                  style={{ ...puce(mode === m.value), minHeight: 48, fontSize: 14, fontWeight: 700 }}>
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'cash' && panier.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input data-testid="remis" inputMode="numeric" placeholder={t('Montant remis', 'Amount given')} value={remis}
                  onChange={e => setRemis(e.target.value.replace(/[^\d]/g, ''))}
                  style={{ flex: 1, minHeight: 44, fontSize: 16, padding: '0 10px', border: '1px solid #D9CFC4', borderRadius: 8 }} />
                {[1000, 2000, 5000, 10000].map(v => (
                  <button key={v} type="button" onClick={() => setRemis(String(v))} style={{ ...puce(false), minHeight: 44, padding: '0 8px', fontSize: 12 }}>{v / 1000}k</button>
                ))}
              </div>
            )}
            {monnaie > 0 && (
              <div data-testid="monnaie" style={{ textAlign: 'right', fontSize: 14 }}>
                {t('À rendre', 'Change')} : <b>{fmt(monnaie)}</b>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" data-testid="btn-vider" onClick={viderPanier} disabled={panier.length === 0}
                style={{ ...puce(false), minHeight: 56, flex: '0 0 30%', opacity: panier.length ? 1 : 0.4 }}>
                {t('Vider', 'Clear')}
              </button>
              <button type="button" data-testid="btn-encaisser" onClick={() => void encaisser()} disabled={panier.length === 0 || encaissement}
                style={{ flex: 1, minHeight: 56, border: 'none', borderRadius: 10, background: panier.length ? 'var(--fs-wine-700)' : '#C9C0B6', color: '#fff', fontWeight: 900, fontSize: 18, cursor: panier.length ? 'pointer' : 'not-allowed' }}>
                {encaissement ? t('Enregistrement…', 'Saving…') : t('ENCAISSER', 'CHARGE')}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {modalRetour && (
        <RetourDeVide
          produits={produitsConsignes}
          consignes={consignes}
          horsLigne={horsLigne}
          onFermer={() => setModalRetour(false)}
          onFait={(montant) => { setModalRetour(false); addToast(t(`Consigne rendue : ${fmt(montant)} à remettre au client`, `Deposit refunded: give ${fmt(montant)} to the customer`), 'success'); }}
          onErreur={(m) => addToast(m, 'error')}
        />
      )}
    </div>
  );
}

// ── Retour de vide ────────────────────────────────────────────────────────────

function RetourDeVide({ produits, consignes, horsLigne, onFermer, onFait, onErreur }: {
  produits: Product[]; consignes: Record<string, number>; horsLigne: boolean;
  onFermer: () => void; onFait: (montant: number) => void; onErreur: (message: string) => void;
}) {
  const [choix, setChoix] = useState<Product | null>(null);
  const [qte, setQte]     = useState(1);
  const [envoi, setEnvoi] = useState(false);
  const montant = choix ? (consignes[choix._id] ?? 0) * qte : 0;

  const valider = async () => {
    if (!choix || envoi) return;
    if (horsLigne || !navigator.onLine) {
      onErreur(t('Retour de vide impossible hors ligne : rendez la consigne et enregistrez-la au retour du réseau', 'Empties return needs the network: refund now and record it once back online'));
      return;
    }
    setEnvoi(true);
    try {
      const r = await retournerVides({ productId: choix._id, quantite: qte, idempotencyKey: nouvelleCle() });
      onFait(r.montant);
    } catch (e) {
      onErreur(e instanceof Error ? e.message : t('Erreur', 'Error'));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div data-testid="modal-retour" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={onFermer}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(520px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', fontWeight: 800, fontSize: 18, borderBottom: '1px solid #EEE' }}>↩ {t('Retour de vide — consigne rendue', 'Empties return — deposit refunded')}</div>
        <div style={{ padding: 12, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {produits.length === 0 && <div style={{ gridColumn: '1 / -1', color: 'var(--fs-ink-500)' }}>{t('Aucun produit consigné.', 'No product carries a deposit.')}</div>}
          {produits.map(p => (
            <button key={p._id} type="button" data-testid="retour-produit" onClick={() => setChoix(p)}
              style={{ ...puce(choix?._id === p._id), minHeight: 56, textAlign: 'left', padding: '8px 10px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 700 }}>{displayName(p.name)}</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{t('Consigne', 'Deposit')} {fmt(consignes[p._id] ?? 0)}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #EEE', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" aria-label={t('Moins', 'Less')} onClick={() => setQte(q => Math.max(1, q - 1))} style={boutonQte}>−</button>
          <span data-testid="retour-qte" style={{ minWidth: 28, textAlign: 'center', fontWeight: 800, fontSize: 18 }}>{qte}</span>
          <button type="button" aria-label={t('Plus', 'More')} onClick={() => setQte(q => q + 1)} style={boutonQte}>+</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={onFermer} style={{ ...puce(false), minHeight: 48 }}>{t('Annuler', 'Cancel')}</button>
          <button type="button" data-testid="btn-rembourser" onClick={() => void valider()} disabled={!choix || envoi}
            style={{ minHeight: 48, border: 'none', borderRadius: 10, padding: '0 16px', background: choix ? 'var(--fs-wine-700)' : '#C9C0B6', color: '#fff', fontWeight: 800, fontSize: 15 }}>
            {t(`Rembourser ${fmt(montant)}`, `Refund ${fmt(montant)}`)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Briques ───────────────────────────────────────────────────────────────────

function Carte({ produit, consigne, onClick }: { produit: Product; consigne: number; onClick: () => void }) {
  const rupture = produit.stock <= 0;
  return (
    <button type="button" data-testid="carte-produit" data-produit={produit._id} disabled={rupture} onClick={onClick}
      style={{ minHeight: 110, border: 'none', borderRadius: 12, background: couleurCarte(produit.category), padding: 10, textAlign: 'left',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', opacity: rupture ? 0.45 : 1, cursor: rupture ? 'not-allowed' : 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)', position: 'relative', userSelect: 'none' }}>
      <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2, color: 'var(--fs-ink-900)' }}>{displayName(produit.name)}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: 'var(--fs-font-mono)' }}>{fmt(effectivePrice(produit))}</div>
          {consigne > 0 && <div data-testid="badge-consigne" style={{ fontSize: 11, fontWeight: 700, color: '#7A4B00' }}>+{fmt(consigne)} {t('consigne', 'deposit')}</div>}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, background: rupture ? 'var(--fs-ink-700)' : 'rgba(255,255,255,0.7)', color: rupture ? '#fff' : 'var(--fs-ink-700)', borderRadius: 999, padding: '2px 8px' }}>
          {rupture ? t('RUPTURE', 'OUT') : produit.stock}
        </div>
      </div>
    </button>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ ...puce(actif), minHeight: 48, padding: '0 18px', fontSize: 15, whiteSpace: 'nowrap' }}>{children}</button>;
}

const puce = (actif: boolean): React.CSSProperties => ({
  border: actif ? '2px solid var(--fs-wine-700)' : '2px solid #D9CFC4',
  background: actif ? 'var(--fs-wine-700)' : '#fff',
  color: actif ? '#fff' : 'var(--fs-ink-700)',
  borderRadius: 10, fontWeight: 700, cursor: 'pointer',
});
const badge = (fond: string): React.CSSProperties => ({ background: fond, color: '#fff', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800 });
const boutonEntete: React.CSSProperties = { background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10, minHeight: 44, padding: '0 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const boutonQte: React.CSSProperties = { width: 44, height: 44, borderRadius: 10, border: '1px solid #D9CFC4', background: '#fff', fontSize: 22, fontWeight: 800, cursor: 'pointer', color: 'var(--fs-ink-900)' };
