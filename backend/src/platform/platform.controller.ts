import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ProvisionnementService, DemandeBoutique } from './provisionnement.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { PaiementService } from './paiement/paiement.service';

/**
 * Back-office plateforme — réservé au `superadmin`.
 *
 * `superadmin` est le SEUL rôle qui traverse les boutiques. Il est traité
 * comme la dérogation qu'il est, avec les mêmes garanties que le consolidé :
 *  - `@Roles('superadmin')` : un patron, même propriétaire de plusieurs
 *    boutiques, se voit refuser l'accès (test à l'appui) ;
 *  - le service ne lit et n'écrit les données métier qu'en ENTRANT dans le
 *    contexte d'une boutique (`runWithTenant`), jamais en retirant la
 *    barrière : aucun `skipTenant` dans `platform/*.service.ts` ;
 *  - les collections plateforme (Proprietaire, Boutique, Licence) sont hors
 *    cloisonnement par nature — c'est l'usage prévu de l'option de schéma.
 */
@Controller('platform')
@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
export class PlatformController {
  constructor(
    private provisionnement: ProvisionnementService,
    private paiements: PaiementService,
    private auditService: AuditService,
  ) {}

  /** Toutes les boutiques, avec l'état de leur licence. */
  @Get('boutiques')
  boutiques() {
    return this.provisionnement.listerBoutiques();
  }

  @Post('boutiques')
  async creer(@Body() body: DemandeBoutique, @Req() req: Request) {
    const acteur = (req as any)['user'];
    const resultat = await this.provisionnement.creerBoutique(body);
    this.auditService.log({
      type: 'creation', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Boutique « ${resultat.boutique.nom} » provisionnée`,
      meta: { tenantId: resultat.boutique.tenantId },
    });
    return resultat;
  }

  /** Suspension / réactivation — décision de la plateforme, distincte de la licence. */
  @Patch('boutiques/:id/statut')
  async statut(@Param('id') id: string, @Body() body: { statut: 'active' | 'suspendue' }, @Req() req: Request) {
    const acteur = (req as any)['user'];
    const boutique = await this.provisionnement.changerStatutBoutique(id, body.statut);
    this.auditService.log({
      type: 'modification', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Boutique « ${boutique.nom} » : statut ${body.statut}`,
      meta: { boutiqueId: id, statut: body.statut },
    });
    return boutique;
  }

  /**
   * Prolongation d'un an — après un règlement reçu par le revendeur.
   *
   * Le corps décrit le règlement (montant, moyen, note) ; il est enregistré
   * comme un `Paiement` confirmé, source « manuel », AVANT que la licence ne
   * bouge. Sans corps : plein tarif, Mobile Money.
   */
  @Post('boutiques/:id/prolonger')
  async prolonger(
    @Param('id') id: string,
    @Body() body: { montant?: number; moyen?: string; note?: string } | undefined,
    @Req() req: Request,
  ) {
    const acteur = (req as any)['user'];
    const { licence, paiement } = await this.paiements.enregistrerReglementManuel(id, body ?? {}, acteur);
    this.auditService.log({
      type: 'modification', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Licence prolongée jusqu'au ${new Date(licence!.dateEcheance).toLocaleDateString('fr-FR')} — ` +
        `règlement ${paiement.montant.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} ${paiement.devise} (${paiement.moyenReglement}) ${paiement.reference}`,
      meta: { boutiqueId: id, dateEcheance: licence!.dateEcheance, reference: paiement.reference, montant: paiement.montant, moyen: paiement.moyenReglement },
    });
    return {
      id: String(licence!._id), montant: licence!.montant, devise: licence!.devise,
      dateDebut: licence!.dateDebut, dateEcheance: licence!.dateEcheance, statut: licence!.statut,
      reglement: paiement,
    };
  }

  /** Historique des paiements d'une boutique — en ligne et manuels. */
  @Get('boutiques/:id/paiements')
  paiementsBoutique(@Param('id') id: string) {
    return this.paiements.listerPourBoutique(id);
  }
}
