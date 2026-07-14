// File hors-ligne du MAGAZINIER : créations de produits et réceptions
// enregistrées en local (IndexedDB) quand le réseau manque, puis
// synchronisées automatiquement au retour de la connexion.
//
// Principe :
//  - un produit créé hors-ligne reçoit un identifiant temporaire « temp-… »
//    et apparaît immédiatement dans les listes (recherche comprise) ;
//  - une réception peut référencer ces identifiants temporaires ;
//  - à la synchro : produits d'abord (temp → vrai _id, correspondance
//    conservée), puis réceptions (identifiants remplacés, clé d'idempotence
//    → jamais de doublon même si le rejeu est interrompu).
import { get, set } from 'idb-keyval';
import { createProduct, getProductByBarcode, Product, ProductPayload } from '../api/products';
import { createReception } from '../api/magazinier';

const KEY_PRODUITS   = 'magazin_pending_produits';
const KEY_RECEPTIONS = 'magazin_pending_receptions';
const KEY_IDMAP      = 'magazin_temp_id_map';

export interface ProduitLocal {
  tempId: string;
  payload: ProductPayload;
  createdAt: string;
}

export interface ReceptionLocale {
  id: string;
  fournisseur: string;
  items: { productId: string; quantity: number }[]; // productId peut être un temp-…
  note?: string;
  idempotencyKey: string;
  createdAt: string;
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const estIdTemporaire = (id: string) => id.startsWith('temp-');

// ── Files d'attente ───────────────────────────────────────────────────────────

export async function queueProduitLocal(payload: ProductPayload): Promise<Product> {
  const pending: ProduitLocal[] = (await get<ProduitLocal[]>(KEY_PRODUITS)) ?? [];
  const tempId = `temp-${uid()}`;
  pending.push({ tempId, payload, createdAt: new Date().toISOString() });
  await set(KEY_PRODUITS, pending);
  // Objet produit affichable immédiatement dans les listes locales
  return {
    _id: tempId,
    name: payload.name,
    barcode: payload.barcode,
    category: payload.category,
    subCategory: payload.subCategory,
    unit: payload.unit ?? 'unité',
    price: payload.price ?? 0,
    costPrice: payload.costPrice ?? 0,
    stock: 0,
    stockMagazin: 0,
    alertThreshold: 5,
    expiryDate: payload.expiryDate ?? null,
  } as unknown as Product;
}

export async function queueReceptionLocale(data: { fournisseur: string; items: { productId: string; quantity: number }[]; note?: string }): Promise<void> {
  const pending: ReceptionLocale[] = (await get<ReceptionLocale[]>(KEY_RECEPTIONS)) ?? [];
  pending.push({ id: uid(), idempotencyKey: uid(), createdAt: new Date().toISOString(), ...data });
  await set(KEY_RECEPTIONS, pending);
}

export async function getPendingMagazin(): Promise<{ produits: number; receptions: number }> {
  const [p, r] = await Promise.all([get<ProduitLocal[]>(KEY_PRODUITS), get<ReceptionLocale[]>(KEY_RECEPTIONS)]);
  return { produits: (p ?? []).length, receptions: (r ?? []).length };
}

// ── Synchronisation ───────────────────────────────────────────────────────────

export async function syncMagazin(): Promise<{ produitsSync: number; receptionsSync: number; restants: number }> {
  if (!navigator.onLine) {
    const c = await getPendingMagazin();
    return { produitsSync: 0, receptionsSync: 0, restants: c.produits + c.receptions };
  }

  const idMap: Record<string, string> = (await get<Record<string, string>>(KEY_IDMAP)) ?? {};
  let produitsSync = 0;
  let receptionsSync = 0;

  // 1) Produits d'abord (les réceptions peuvent en dépendre)
  const produits: ProduitLocal[] = (await get<ProduitLocal[]>(KEY_PRODUITS)) ?? [];
  const produitsRestants: ProduitLocal[] = [];
  for (const p of produits) {
    try {
      const created = await createProduct(p.payload);
      idMap[p.tempId] = created._id;
      produitsSync++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      // Code-barres déjà existant (créé entre-temps / doublon) : on rattache au produit existant
      if (p.payload.barcode && /code|barre|existe|duplicate|utilisé/i.test(msg)) {
        try {
          const found = await getProductByBarcode(p.payload.barcode);
          idMap[p.tempId] = found._id;
          produitsSync++;
          continue;
        } catch { /* toujours introuvable → on garde en attente */ }
      }
      produitsRestants.push(p);
    }
  }
  await set(KEY_PRODUITS, produitsRestants);
  await set(KEY_IDMAP, idMap);

  // 2) Réceptions (identifiants temporaires remplacés par les vrais)
  const receptions: ReceptionLocale[] = (await get<ReceptionLocale[]>(KEY_RECEPTIONS)) ?? [];
  const receptionsRestantes: ReceptionLocale[] = [];
  for (const r of receptions) {
    const items = r.items.map(it => ({ ...it, productId: idMap[it.productId] ?? it.productId }));
    if (items.some(it => estIdTemporaire(it.productId))) {
      // Un produit local n'a pas encore pu être synchronisé → on attend
      receptionsRestantes.push(r);
      continue;
    }
    try {
      await createReception({ fournisseur: r.fournisseur, items, note: r.note, idempotencyKey: r.idempotencyKey });
      receptionsSync++;
    } catch {
      receptionsRestantes.push(r);
    }
  }
  await set(KEY_RECEPTIONS, receptionsRestantes);

  return { produitsSync, receptionsSync, restants: produitsRestants.length + receptionsRestantes.length };
}
