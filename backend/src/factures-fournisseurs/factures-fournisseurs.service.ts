import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FactureFournisseur, FactureFournisseurDocument, LigneFacture } from './facture-fournisseur.schema';
import { Product, ProductDocument } from '../schemas/product.schema';
import { MagazinierService } from '../magazinier/magazinier.service';
import { EXTRACTEUR_FACTURE, ExtracteurFacture, MIMES_ACCEPTES, TAILLE_MAX_OCTETS } from './extracteur';
import { apparierLignes } from './appariement';

/** Ce que l'utilisateur renvoie après contrôle : une ligne corrigée. */
export interface LigneValidee {
  designation: string;
  quantite: number;
  prixUnitaire?: number | null;
  /** Produit existant retenu… */
  produitId?: string | null;
  /** …ou produit à créer (nom, prix de vente, catégorie, unité). */
  creer?: { name?: string; price?: number; category?: string; subCategory?: string; unit?: string } | null;
  /** Ligne à ne pas réceptionner (frais de port, remise, doublon…). */
  ignorer?: boolean;
}

export interface CorpsValidation {
  fournisseur?: string;
  numeroFacture?: string;
  lignes: LigneValidee[];
  /** Reporter le prix unitaire de la facture dans le prix d'achat du produit. */
  mettreAJourPrixAchat?: boolean;
}

/**
 * Import → lecture automatique → contrôle humain → réception fournisseur.
 *
 * Rien n'entre en stock à l'import : l'extraction est une PROPOSITION stockée
 * `a_verifier`. C'est la validation — par une personne, ligne par ligne — qui
 * crée les produits manquants et déclenche la réception (stock entrepôt,
 * mouvements tracés, fournisseur), via le même service que la réception
 * manuelle du magasinier. Une facture validée ne l'est qu'une fois : la
 * réception porte une clé d'idempotence dérivée de la facture.
 */
@Injectable()
export class FacturesFournisseursService {
  constructor(
    @InjectModel(FactureFournisseur.name) private factureModel: Model<FactureFournisseurDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @Inject(EXTRACTEUR_FACTURE) private extracteur: ExtracteurFacture,
    private magazinier: MagazinierService,
  ) {}

  private sansFichier(doc: any) {
    const o = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
    delete o.fichier;
    return o;
  }

  // ── Import + lecture ──────────────────────────────────────────────────────

  async importer(corps: { fichierBase64: string; mimeType: string; nomFichier?: string }, userId: string) {
    const mimeType = (corps.mimeType ?? '').toLowerCase().trim();
    if (!(MIMES_ACCEPTES as readonly string[]).includes(mimeType)) {
      throw new BadRequestException(`Format non pris en charge (${mimeType || 'inconnu'}) — photo JPEG/PNG/WEBP ou PDF.`);
    }
    if (!corps.fichierBase64) throw new BadRequestException('Fichier manquant.');
    const fichier = Buffer.from(corps.fichierBase64, 'base64');
    if (fichier.length === 0) throw new BadRequestException('Fichier vide ou illisible.');
    if (fichier.length > TAILLE_MAX_OCTETS) {
      throw new BadRequestException(`Fichier trop lourd (${Math.round(fichier.length / 1024 / 1024)} Mo) — 8 Mo maximum.`);
    }

    const extraction = await this.extracteur.extraire(fichier, mimeType);
    const produits = await this.productModel.find({}, { name: 1, barcode: 1 }).lean();
    const lignes: LigneFacture[] = apparierLignes(extraction.lignes, produits as any).map(l => ({
      designation: l.designation, quantite: l.quantite,
      prixUnitaire: l.prixUnitaire, prixTotal: l.prixTotal, reference: l.reference,
      produitId: l.produitId ? new Types.ObjectId(l.produitId) : null,
      produitNom: l.produitNom, appariement: l.appariement,
    }));

    const doc = await this.factureModel.create({
      nomFichier: (corps.nomFichier ?? 'facture').slice(0, 120),
      mimeType, taille: fichier.length, fichier,
      fournisseur:   extraction.fournisseur ?? '',
      numeroFacture: extraction.numeroFacture ?? '',
      dateFacture:   extraction.dateFacture ?? '',
      total:         extraction.total,
      confiance:     extraction.confiance,
      remarques:     extraction.remarques ?? '',
      lignes,
      extracteur:    this.extracteur.nom,
      importeePar:   new Types.ObjectId(userId),
    });
    return this.sansFichier(doc);
  }

  // ── Consultation ──────────────────────────────────────────────────────────

  lister(statut?: string) {
    const filtre = statut ? { statut } : {};
    return this.factureModel.find(filtre).sort({ createdAt: -1 }).limit(200).lean();
  }

  async obtenir(id: string) {
    const doc = await this.factureModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Facture introuvable');
    return doc;
  }

  /** Le justificatif archivé — seul endroit où `fichier` est chargé. */
  async fichier(id: string) {
    const doc = await this.factureModel.findById(id).select('+fichier').lean();
    if (!doc) throw new NotFoundException('Facture introuvable');
    // En lecture `lean()`, le pilote rend un `Binary` (avec `.buffer`), pas un
    // Buffer Node : sans cette conversion, la réponse HTTP serait vide.
    const brut: any = doc.fichier;
    const fichier: Buffer = Buffer.isBuffer(brut) ? brut : Buffer.from(brut?.buffer ?? brut ?? []);
    return { fichier, mimeType: doc.mimeType, nomFichier: doc.nomFichier };
  }

  // ── Validation → réception ────────────────────────────────────────────────

  async valider(id: string, corps: CorpsValidation, userId: string) {
    const facture = await this.factureModel.findById(id);
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.statut !== 'a_verifier') {
      throw new BadRequestException(`Cette facture est déjà ${facture.statut === 'validee' ? 'validée' : 'rejetée'}.`);
    }
    const fournisseur = (corps.fournisseur ?? facture.fournisseur ?? '').trim();
    if (!fournisseur) throw new BadRequestException('Le nom du fournisseur est requis.');
    const retenues = (corps.lignes ?? []).filter(l => !l.ignorer);
    if (retenues.length === 0) throw new BadRequestException('Aucune ligne à réceptionner.');

    const items: { productId: string; quantity: number }[] = [];
    const lignesFinales: LigneFacture[] = [];
    let produitsCrees = 0;

    for (const l of retenues) {
      const quantite = Number(l.quantite);
      if (!Number.isFinite(quantite) || quantite <= 0) {
        throw new BadRequestException(`Quantité invalide pour « ${l.designation} ».`);
      }
      const prixUnitaire = l.prixUnitaire == null ? null : Math.max(0, Number(l.prixUnitaire));

      let produit: ProductDocument | null = null;
      if (l.produitId) {
        produit = await this.productModel.findById(l.produitId);
        if (!produit) throw new BadRequestException(`Produit introuvable pour « ${l.designation} ».`);
        if (corps.mettreAJourPrixAchat && prixUnitaire && prixUnitaire !== produit.costPrice) {
          produit.costPrice = prixUnitaire;
          await produit.save();
        }
      } else {
        const c = l.creer ?? {};
        const name = (c.name ?? l.designation ?? '').trim();
        if (!name) throw new BadRequestException('Un produit à créer doit avoir un nom.');
        produit = await this.productModel.create({
          name, price: Math.max(0, Number(c.price ?? 0)), costPrice: prixUnitaire ?? 0,
          stock: 0, stockMagazin: 0, initialStock: 0,
          category: c.category ?? '', subCategory: c.subCategory ?? '', unit: c.unit ?? 'pce',
        });
        produitsCrees++;
      }

      items.push({ productId: String(produit._id), quantity: quantite });
      lignesFinales.push({
        designation: l.designation, quantite, prixUnitaire,
        prixTotal: prixUnitaire == null ? null : prixUnitaire * quantite,
        reference: null, produitId: produit._id as Types.ObjectId, produitNom: produit.name, appariement: l.produitId ? 'existant' : 'nouveau',
      });
    }

    const numero = (corps.numeroFacture ?? facture.numeroFacture ?? '').trim();
    const reception = await this.magazinier.createReception({
      fournisseur, items,
      note: `Facture fournisseur${numero ? ' n° ' + numero : ''} — import lecture automatique`,
      idempotencyKey: `facture-fournisseur:${facture._id}`,
    }, userId);

    facture.statut = 'validee';
    facture.fournisseur = fournisseur;
    facture.numeroFacture = numero;
    facture.lignes = lignesFinales;
    facture.valideePar = new Types.ObjectId(userId);
    facture.valideeLe = new Date();
    facture.receptionId = (reception as any)._id ?? null;
    await facture.save();

    return { facture: this.sansFichier(facture), receptionId: facture.receptionId, produitsCrees, articlesRecus: items.reduce((s, i) => s + i.quantity, 0) };
  }

  async rejeter(id: string, motif: string, userId: string) {
    const facture = await this.factureModel.findById(id);
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.statut !== 'a_verifier') throw new BadRequestException('Seule une facture à vérifier peut être rejetée.');
    if (!motif?.trim()) throw new BadRequestException('Le motif du rejet est requis.');
    facture.statut = 'rejetee';
    facture.motifRejet = motif.trim();
    facture.valideePar = new Types.ObjectId(userId);
    facture.valideeLe = new Date();
    await facture.save();
    return this.sansFichier(facture);
  }
}
