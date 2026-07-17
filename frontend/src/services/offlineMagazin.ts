// File hors-ligne du MAGASINIER : créations de produits et réceptions
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
import { createProduct, getProductByBarcode, updateProduct, Product, ProductPayload } from '../api/products';
import { createReception } from '../api/magazinier';
import { addStockWithMovement } from '../api/stock';

const KEY_PRODUITS     = 'magazin_pending_produits';
const KEY_RECEPTIONS   = 'magazin_pending_receptions';
const KEY_AJOUTS       = 'stock_pending_ajouts';        // gestionnaire : +N sur le stock caisse
const KEY_AJUSTEMENTS  = 'stock_pending_ajustements';   // gestionnaire : inventaire (valeur absolue)
const KEY_IDMAP        = 'magazin_temp_id_map';

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

// Prévient les bandeaux affichés qu'une opération vient d'entrer en file
const signalerFile = () => { try { window.dispatchEvent(new Event('offline-queue-changed')); } catch { /* SSR */ } };

export const estIdTemporaire = (id: string) => id.startsWith('temp-');

// ── Files d'attente ───────────────────────────────────────────────────────────

export async function queueProduitLocal(payload: ProductPayload): Promise<Product> {
  const pending: ProduitLocal[] = (await get<ProduitLocal[]>(KEY_PRODUITS)) ?? [];
  const tempId = `temp-${uid()}`;
  pending.push({ tempId, payload, createdAt: new Date().toISOString() });
  await set(KEY_PRODUITS, pending);
  signalerFile();
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
  signalerFile();
}

// ── Files du gestionnaire de stock ────────────────────────────────────────────

export interface AjoutStockLocal {
  productId: string;      // peut être un temp-…
  quantity: number;       // ajout RELATIF (+N sur le stock caisse)
  note?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface AjustementStockLocal {
  productId: string;      // peut être un temp-…
  stock: number;          // valeur ABSOLUE (inventaire) — rejeu sans risque
  createdAt: string;
}

export async function queueAjoutStock(data: { productId: string; quantity: number; note?: string }): Promise<void> {
  const pending: AjoutStockLocal[] = (await get<AjoutStockLocal[]>(KEY_AJOUTS)) ?? [];
  pending.push({ ...data, idempotencyKey: uid(), createdAt: new Date().toISOString() });
  await set(KEY_AJOUTS, pending);
  signalerFile();
}

export async function queueAjustementStock(data: { productId: string; stock: number }): Promise<void> {
  const pending: AjustementStockLocal[] = (await get<AjustementStockLocal[]>(KEY_AJUSTEMENTS)) ?? [];
  // Une seule valeur par produit : la DERNIÈRE saisie d'inventaire gagne
  const filtres = pending.filter(a => a.productId !== data.productId);
  filtres.push({ ...data, createdAt: new Date().toISOString() });
  await set(KEY_AJUSTEMENTS, filtres);
  signalerFile();
}

export async function getPendingMagazin(): Promise<{ produits: number; receptions: number; ajouts: number; ajustements: number; total: number }> {
  const [p, r, a, j] = await Promise.all([
    get<ProduitLocal[]>(KEY_PRODUITS), get<ReceptionLocale[]>(KEY_RECEPTIONS),
    get<AjoutStockLocal[]>(KEY_AJOUTS), get<AjustementStockLocal[]>(KEY_AJUSTEMENTS),
  ]);
  const produits = (p ?? []).length, receptions = (r ?? []).length, ajouts = (a ?? []).length, ajustements = (j ?? []).length;
  return { produits, receptions, ajouts, ajustements, total: produits + receptions + ajouts + ajustements };
}

// ── Synchronisation ───────────────────────────────────────────────────────────

export async function syncMagazin(): Promise<{ produitsSync: number; receptionsSync: number; stockSync: number; restants: number }> {
  if (!navigator.onLine) {
    const c = await getPendingMagazin();
    return { produitsSync: 0, receptionsSync: 0, stockSync: 0, restants: c.total };
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

  // 3) Ajouts de stock caisse du gestionnaire (+N, idempotents côté serveur)
  let stockSync = 0;
  const ajouts: AjoutStockLocal[] = (await get<AjoutStockLocal[]>(KEY_AJOUTS)) ?? [];
  const ajoutsRestants: AjoutStockLocal[] = [];
  for (const a of ajouts) {
    const pid = idMap[a.productId] ?? a.productId;
    if (estIdTemporaire(pid)) { ajoutsRestants.push(a); continue; }
    try {
      await addStockWithMovement(pid, a.quantity, a.note, a.idempotencyKey);
      stockSync++;
    } catch { ajoutsRestants.push(a); }
  }
  await set(KEY_AJOUTS, ajoutsRestants);

  // 4) Ajustements d'inventaire (valeur absolue → rejeu naturellement sûr)
  const ajustements: AjustementStockLocal[] = (await get<AjustementStockLocal[]>(KEY_AJUSTEMENTS)) ?? [];
  const ajustementsRestants: AjustementStockLocal[] = [];
  for (const j of ajustements) {
    const pid = idMap[j.productId] ?? j.productId;
    if (estIdTemporaire(pid)) { ajustementsRestants.push(j); continue; }
    try {
      await updateProduct(pid, { stock: j.stock });
      stockSync++;
    } catch { ajustementsRestants.push(j); }
  }
  await set(KEY_AJUSTEMENTS, ajustementsRestants);

  const restants = produitsRestants.length + receptionsRestantes.length + ajoutsRestants.length + ajustementsRestants.length;
  return { produitsSync, receptionsSync, stockSync, restants };
}
