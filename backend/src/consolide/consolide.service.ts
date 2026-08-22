import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sale, SaleDocument } from '../schemas/sale.schema';
import { Settings, SettingsDocument } from '../settings/settings.schema';
import { runWithTenant } from '../tenancy/tenant-context';

/**
 * Rapports consolidés — la SEULE dérogation du produit qui traverse les
 * boutiques. Traitée comme telle.
 *
 * Quatre garanties, chacune vérifiable :
 *
 *  1. **Périmètre borné au jeton.** Les boutiques agrégées viennent
 *     exclusivement de la liste `boutiques` signée par le serveur à la
 *     connexion. Jamais une liste fournie par le client, jamais une liste
 *     reconstruite ici : un propriétaire ne peut pas élargir son périmètre,
 *     même en connaissant l'identifiant d'une autre boutique.
 *
 *  2. **Le cloisonnement n'est jamais désactivé.** Chaque boutique est lue
 *     dans SON contexte (`runWithTenant`), donc le plugin Mongoose filtre
 *     normalement. Il n'y a **aucun `skipTenant` ici** : la traversée se fait
 *     en parcourant des contextes, pas en retirant la barrière. C'est ce qui
 *     distingue une dérogation encadrée d'un trou.
 *
 *  3. **Lecture seule, techniquement.** Ce service n'appelle que `aggregate()`
 *     et `find().lean()`. Une agrégation sans `$out` ni `$merge` ne peut rien
 *     écrire. `consolide-lecture-seule.spec.ts` lit ces sources et échoue si
 *     une méthode d'écriture y apparaît.
 *
 *  4. **Un magasin par ligne, jamais une requête unique décloisonnée.**
 */
@Injectable()
export class ConsolideService {
  constructor(
    @InjectModel(Sale.name)     private saleModel:     Model<SaleDocument>,
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
  ) {}

  /**
   * Chiffres par boutique sur une période, plus le total.
   *
   * `boutiquesAutorisees` DOIT provenir du jeton (`req.user.boutiques`).
   * Le contrôleur ne lui passe rien d'autre.
   */
  async rapport(boutiquesAutorisees: string[], debut?: string, fin?: string) {
    const bornes = this.bornes(debut, fin);

    const boutiques = [];
    for (const boutiqueId of boutiquesAutorisees ?? []) {
      boutiques.push(await this.chiffresDUneBoutique(boutiqueId, bornes));
    }

    const total = boutiques.reduce(
      (acc, b) => ({ ca: acc.ca + b.ca, ventes: acc.ventes + b.ventes }),
      { ca: 0, ventes: 0 },
    );

    return {
      debut: bornes.debut.toISOString(),
      fin:   bornes.fin.toISOString(),
      boutiques,
      total: { ...total, panierMoyen: total.ventes ? Math.round(total.ca / total.ventes) : 0 },
    };
  }

  /**
   * Nom de chaque boutique du périmètre — pour le sélecteur et l'en-tête des
   * rapports. Même borne que le reste : la liste signée du jeton.
   */
  async boutiques(boutiquesAutorisees: string[]) {
    const sortie = [];
    for (const boutiqueId of boutiquesAutorisees ?? []) {
      const nom = await runWithTenant(boutiqueId, async () => {
        const s: any = await this.settingsModel.findOne().lean();
        return (s?.nomMagasin as string)?.trim() || boutiqueId;
      });
      sortie.push({ boutiqueId, nom });
    }
    return sortie;
  }

  /** Une boutique, lue DANS son contexte : le plugin filtre comme d'habitude. */
  private async chiffresDUneBoutique(boutiqueId: string, bornes: { debut: Date; fin: Date }) {
    return runWithTenant(boutiqueId, async () => {
      // `aggregate` ne peut rien écrire (aucun $out ni $merge), et le plugin
      // pose son $match { tenant } en tête du pipeline.
      const [agr] = await this.saleModel.aggregate([
        { $match: { createdAt: { $gte: bornes.debut, $lte: bornes.fin } } },
        { $group: { _id: null, ca: { $sum: '$total' }, ventes: { $sum: 1 } } },
      ]);

      const settings: any = await this.settingsModel.findOne().lean();

      const ca = Math.round(agr?.ca ?? 0);
      const ventes = agr?.ventes ?? 0;
      return {
        boutiqueId,
        nom: (settings?.nomMagasin as string)?.trim() || boutiqueId,
        ca,
        ventes,
        panierMoyen: ventes ? Math.round(ca / ventes) : 0,
      };
    });
  }

  /** Période demandée, par défaut le mois en cours, bornes en heure locale. */
  private bornes(debut?: string, fin?: string) {
    const maintenant = new Date();
    const d = debut ? new Date(debut) : new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const f = fin ? new Date(fin) : maintenant;
    d.setHours(0, 0, 0, 0);
    f.setHours(23, 59, 59, 999);
    return { debut: d, fin: f };
  }
}
