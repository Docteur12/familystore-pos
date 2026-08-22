// Stockage cloisonné par boutique : `idbLire`/`idbEcrire` préfixent la clé
// par la boutique active et LÈVENT s'il n'y en a pas (voir services/storage.ts).
import { idbLire as get, idbEcrire as set, exigerBoutiqueActive, boutiqueActive, boutiqueDuJeton, jeton } from './storage';
import { authHeaders } from '../api/http';
import type { Product } from '../api/products';
import { buildReceiptPDF } from '../components/ReceiptPrint';
import { saveFacture } from '../api/factures';
import { getSettings, storeIdentity } from '../api/settings';
import { t } from '../i18n';

// ── Keys ──────────────────────────────────────────────────────────────────────

const KEY_PRODUCTS  = 'products';
const KEY_PENDING   = 'pending_sales';
const KEY_LAST_SYNC = 'last_sync_time';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingSale {
  id: string;
  items: { product?: string; name: string; quantity: number; unitPrice: number; divers?: boolean }[];
  total: number;
  subtotal?: number;      // avant réduction facture
  offrePct?: number;      // % réduction facture appliquée
  offreAmt?: number;      // montant déduit
  cashierName?: string;   // pour l'archive facture à la synchro
  paymentLabel?: string;  // libellé du mode de paiement (archive facture)
  paymentMethod: string;
  amountPaid: number;
  createdAt: string;
  idempotencyKey?: string;
  /**
   * Boutique où la vente a été encaissée. Estampillée à l'enregistrement et
   * revérifiée avant l'envoi : la clé de stockage est déjà cloisonnée, ceci
   * est la SECONDE barrière — une vente ne doit jamais partir avec le jeton
   * d'une autre boutique (exigence 3 du lot A).
   */
  boutiqueId?: string;
}

// ── Product cache ─────────────────────────────────────────────────────────────

export async function cacheProducts(products: Product[]): Promise<void> {
  await set(KEY_PRODUCTS, products);
}

export async function getCachedProducts(): Promise<Product[]> {
  return (await get<Product[]>(KEY_PRODUCTS)) ?? [];
}

export async function decrementCachedStock(productId: string, quantity: number): Promise<void> {
  const products = await getCachedProducts();
  const updated = products.map(p =>
    p._id === productId ? { ...p, stock: Math.max(0, p.stock - quantity) } : p,
  );
  await set(KEY_PRODUCTS, updated);
}

// ── Pending sales queue ───────────────────────────────────────────────────────

export async function savePendingSale(
  sale: Omit<PendingSale, 'id' | 'createdAt'>,
): Promise<void> {
  const pending: PendingSale[] = (await get<PendingSale[]>(KEY_PENDING)) ?? [];
  pending.push({
    ...sale,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    boutiqueId: exigerBoutiqueActive("enregistrement d'une vente hors-ligne"),
  });
  await set(KEY_PENDING, pending);
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return (await get<PendingSale[]>(KEY_PENDING)) ?? [];
}

// ── Silent background cache refresh ──────────────────────────────────────────

export async function silentRefreshProductCache(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const res = await fetch('/api/products', { headers: authHeaders() });
    if (!res.ok) return;
    const data: Product[] = await res.json();
    await cacheProducts(data);
    await set(KEY_LAST_SYNC, Date.now());
  } catch { /* silently ignore */ }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

export async function getLastSyncTime(): Promise<Date | null> {
  const ts = await get<number>(KEY_LAST_SYNC);
  return ts ? new Date(ts) : null;
}

// Archive la facture PDF d'une vente synchronisée (mêmes données que la vente d'origine).
async function archiveFactureSynchronisee(sale: PendingSale, numero: string, dateVente: Date): Promise<void> {
  // Identité et offre du magasin (la synchro se fait en ligne : paramètres à jour)
  const settings = await getSettings();
  const pdfBase64 = buildReceiptPDF({
    store:        storeIdentity(settings),
    offre:        settings.offreFacture,
    receiptNo:    numero,
    date:         dateVente,
    cashierName:  sale.cashierName ?? t('Caissier', 'Cashier'),
    items:        sale.items.map(i => ({ name: i.name, unit: '', quantity: i.quantity, unitPrice: i.unitPrice })),
    subtotal:     sale.subtotal ?? sale.total,
    total:        sale.total,
    paymentLabel: sale.paymentLabel ?? sale.paymentMethod,
    amountPaid:   sale.amountPaid,
    change:       Math.max(0, sale.amountPaid - sale.total),
    ...(sale.offreAmt && sale.offreAmt > 0
      ? { offreAmt: sale.offreAmt, ...(sale.offrePct && sale.offrePct > 0 ? { offrePct: sale.offrePct } : {}) }
      : {}),
  });
  await saveFacture({
    numero,
    caissier:      sale.cashierName ?? t('Caissier', 'Cashier'),
    montant:       sale.total,
    paymentMethod: sale.paymentLabel ?? sale.paymentMethod,
    items:         sale.items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
    pdfBase64,
    date:          dateVente.toISOString(),
  });
}

export async function syncPendingSales(
  addToast: (msg: string, type: 'success' | 'error' | 'warning') => void,
): Promise<void> {
  if (!navigator.onLine) return;
  const pending = await getPendingSales();
  if (pending.length === 0) return;

  // Boutique du JETON qui va servir, pas celle qu'on croit consulter.
  const boutiqueDuJetonCourant = boutiqueDuJeton(jeton() ?? '');
  const boutiqueCourante = boutiqueActive();

  let synced = 0;
  let refusees = 0;
  const remaining: PendingSale[] = [];

  for (const sale of pending) {
    // ── Seconde barrière (exigence 3) ──────────────────────────────────────
    // La file est déjà cloisonnée par clé ; on revérifie tout de même que la
    // vente appartient bien à la boutique du jeton. Une divergence signale un
    // stockage incohérent : on garde la vente plutôt que de l'envoyer au
    // mauvais magasin, où elle serait irrécupérable.
    const origine = sale.boutiqueId ?? boutiqueCourante;
    if (boutiqueDuJetonCourant && origine && origine !== boutiqueDuJetonCourant) {
      remaining.push(sale);
      refusees++;
      continue;
    }
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          items: sale.items,
          total: sale.total,
          subtotal: sale.subtotal ?? 0,
          offrePct: sale.offrePct ?? 0,
          offreAmt: sale.offreAmt ?? 0,
          dateVente: sale.createdAt, // date réelle de la vente (le serveur la garde)
          paymentMethod: sale.paymentMethod,
          amountPaid: sale.amountPaid,
          idempotencyKey: sale.idempotencyKey,
        }),
      });
      if (res.ok) {
        synced++;
        // Archive la facture PDF (silencieux) — même numérotation FSV que les ventes en ligne
        try {
          const { sale: created } = await res.json();
          const d = new Date(sale.createdAt);
          const numero = `FSV-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${String(created._id).slice(-6).toUpperCase()}`;
          await archiveFactureSynchronisee(sale, numero, d);
        } catch { /* l'archive ne doit jamais bloquer la synchro */ }
      } else {
        remaining.push(sale);
      }
    } catch {
      remaining.push(sale);
    }
  }

  await set(KEY_PENDING, remaining);
  await set(KEY_LAST_SYNC, Date.now());

  if (synced > 0) {
    addToast(t(`${synced} vente(s) synchronisée(s) ✅`, `${synced} sale(s) synced ✅`), 'success');
  }
  if (refusees > 0) {
    addToast(
      t(
        `${refusees} vente(s) appartiennent à une autre boutique — reconnectez-vous sur celle-ci pour les envoyer.`,
        `${refusees} sale(s) belong to another store — sign in to that store to send them.`,
      ),
      'error',
    );
  }
  if (remaining.length > 0) {
    addToast(t(`${remaining.length} vente(s) non synchronisée(s)`, `${remaining.length} sale(s) not synced`), 'error');
  }
}
