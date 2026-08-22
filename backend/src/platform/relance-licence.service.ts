import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Boutique, BoutiqueDocument } from './schemas/boutique.schema';
import { Licence, LicenceDocument, joursAvantEcheance } from './schemas/licence.schema';
import { Proprietaire, ProprietaireDocument } from './schemas/proprietaire.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { runWithTenant } from '../tenancy/tenant-context';

/**
 * Seuils de relance, en jours avant échéance.
 *
 * Doivent rester identiques à `frontend/src/utils/licence.ts` : le bandeau
 * dans l'application et l'e-mail forment un seul préavis, il serait
 * déroutant qu'ils se déclenchent à des moments différents.
 */
export const SEUILS_RELANCE = [14, 7, 3, 1];

/**
 * Relances d'échéance par e-mail.
 *
 * Le bandeau suppose que le commerçant ouvre l'application. Un patron qui ne
 * s'y connecte qu'une fois par semaine découvrirait l'expiration le jour même,
 * ce qui est exactement la surprise qu'on veut éviter.
 *
 * Deux garanties :
 *  - **idempotence** : chaque seuil franchi n'est relancé qu'une fois, la
 *    trace étant portée par la licence elle-même (`relancesEnvoyees`). La
 *    tâche peut donc tourner plusieurs fois par jour et survivre à un
 *    redémarrage sans harceler personne ;
 *  - **un envoi raté n'est jamais marqué comme fait** : la messagerie hors
 *    service ne doit pas faire disparaître un rappel.
 */
@Injectable()
export class RelanceLicenceService implements OnModuleInit {
  private readonly logger = new Logger(RelanceLicenceService.name);

  constructor(
    @InjectModel(Boutique.name)     private boutiqueModel:     Model<BoutiqueDocument>,
    @InjectModel(Licence.name)      private licenceModel:      Model<LicenceDocument>,
    @InjectModel(Proprietaire.name) private proprietaireModel: Model<ProprietaireDocument>,
    @InjectModel(User.name)         private userModel:         Model<UserDocument>,
    private mailService: MailService,
  ) {}

  /**
   * Passage toutes les six heures, plus un au démarrage.
   *
   * Six heures et non vingt-quatre : le service gratuit d'hébergement
   * redémarre souvent, et un intervalle d'un jour raterait des seuils à
   * chaque réveil. L'idempotence rend ces passages supplémentaires inoffensifs.
   */
  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;   // pas de minuterie sous test
    const passage = () => this.relancer().catch(e => this.logger.error(e.message));
    setTimeout(passage, 30_000);                   // laisse l'application démarrer
    setInterval(passage, 6 * 60 * 60 * 1000).unref?.();
  }

  /** Un passage complet. Renvoie le nombre de relances effectivement envoyées. */
  async relancer(maintenant = new Date()): Promise<number> {
    const boutiques = await this.boutiqueModel.find({ statut: 'active' }).lean();
    let envoyees = 0;

    for (const boutique of boutiques as any[]) {
      const licence = await this.licenceModel
        .findOne({ boutique: boutique._id, statut: 'active' })
        .sort({ dateEcheance: -1 });
      if (!licence) continue;

      const seuil = this.seuilAFranchir(licence, maintenant);
      if (seuil === null) continue;

      const destinataire = await this.destinataire(boutique);
      if (!destinataire) {
        this.logger.warn(`[Licence] aucun destinataire pour « ${boutique.nom} » — relance impossible`);
        continue;
      }

      const succes = await this.mailService.envoyerRelanceLicence({
        destinataire,
        nomBoutique: boutique.nom,
        joursRestants: this.joursRestants(licence, maintenant),
        dateEcheance: licence.dateEcheance,
        montant: licence.montant,
        devise: licence.devise,
      });

      // Un envoi raté n'est PAS marqué : le rappel reste dû au prochain passage.
      if (!succes) continue;
      licence.relancesEnvoyees = [...(licence.relancesEnvoyees ?? []), seuil];
      await licence.save();
      envoyees++;
    }

    return envoyees;
  }

  /** Jours calendaires avant l'échéance (voir joursAvantEcheance). */
  private joursRestants(licence: LicenceDocument, maintenant: Date): number {
    return joursAvantEcheance(licence.dateEcheance, maintenant);
  }

  /**
   * Seuil à relancer maintenant, ou `null`.
   *
   * On prend le seuil franchi le PLUS PROCHE encore non envoyé : à cinq jours,
   * si la relance des quatorze jours n'est pas partie (application
   * redémarrée, messagerie indisponible), elle part encore — mieux vaut un
   * rappel tardif que pas de rappel.
   */
  private seuilAFranchir(licence: LicenceDocument, maintenant: Date): number | null {
    const jours = this.joursRestants(licence, maintenant);
    if (jours < 0) return null;                     // déjà expirée : le blocage parle de lui-même
    const deja = new Set(licence.relancesEnvoyees ?? []);
    const candidats = SEUILS_RELANCE.filter(s => jours <= s && !deja.has(s));
    return candidats.length ? Math.max(...candidats) : null;
  }

  /** Le propriétaire d'abord ; à défaut le patron de la boutique. */
  private async destinataire(boutique: any): Promise<string | null> {
    const proprietaire = await this.proprietaireModel.findById(boutique.proprietaire).lean();
    if (proprietaire?.email) return proprietaire.email;

    return runWithTenant(String(boutique.tenantId), async () => {
      const patron = await this.userModel.findOne({ role: 'patron' }).lean();
      return (patron?.email as string) ?? null;
    });
  }
}
