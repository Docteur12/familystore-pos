import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ProvisionnementService, DemandeBoutique } from './provisionnement.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { PaiementService } from './paiement/paiement.service';
import { DemandesBoutiqueService } from './demandes-boutique.service';

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
    private demandes: DemandesBoutiqueService,
    private auditService: AuditService,
  ) {}

  // ── Demandes d'ouverture (mode manuel) ─────────────────────────────────

  /** Toutes les demandes, en attente d'abord. `?statut=` pour filtrer. */
  @Get('demandes')
  listerDemandes(@Query('statut') statut?: string) {
    return this.demandes.listerToutes(statut);
  }

  /** Accepte : crée la boutique, enregistre le règlement reçu, clôt la demande. */
  @Post('demandes/:id/accepter')
  async accepterDemande(
    @Param('id') id: string,
    @Body() body: { montant?: number; moyen?: string; note?: string } | undefined,
    @Req() req: Request,
  ) {
    const acteur = (req as any)['user'];
    const r = await this.demandes.accepter(id, body ?? {}, acteur);
    this.auditService.log({
      type: 'creation', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Demande acceptée — boutique « ${r.boutique.nom} » créée, règlement ${r.paiement.reference}`,
      meta: { demandeId: id, tenantId: r.boutique.tenantId, reference: r.paiement.reference, montant: r.paiement.montant, moyen: r.paiement.moyenReglement },
    });
    return r;
  }

  @Post('demandes/:id/refuser')
  async refuserDemande(@Param('id') id: string, @Body() body: { motif?: string } | undefined, @Req() req: Request) {
    const acteur = (req as any)['user'];
    const demande = await this.demandes.refuser(id, body?.motif ?? '', acteur);
    this.auditService.log({
      type: 'modification', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Demande d'ouverture « ${demande.nom} » refusée — ${demande.motifRefus}`,
      meta: { demandeId: id },
    });
    return demande;
  }

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
   * Type d'établissement — décision du revendeur, JOURNALISÉE (avant → après).
   * `appliquerPrereglage` remplace modules et règles métier par ceux du type ;
   * sinon seul le type change et les choix du patron survivent.
   */
  @Patch('boutiques/:id/type')
  async type(
    @Param('id') id: string,
    @Body() body: { type: string; appliquerPrereglage?: boolean },
    @Req() req: Request,
  ) {
    const acteur = (req as any)['user'];
    const r = await this.provisionnement.changerType(id, body?.type, !!body?.appliquerPrereglage);
    this.auditService.log({
      type: 'modification', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Type de « ${r.boutique.nom} » : ${r.avant} → ${r.apres}${r.prereglageApplique ? ' — préréglage appliqué' : ''}`,
      meta: { boutiqueId: id, avant: r.avant, apres: r.apres, prereglageApplique: r.prereglageApplique },
    });
    return r;
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
