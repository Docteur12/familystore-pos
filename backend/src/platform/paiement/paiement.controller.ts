import {
  Body, Controller, Get, Headers, HttpException, HttpStatus, Param, Post, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PaiementService, DemandeCreationBoutique } from './paiement.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

/**
 * Paiements — côté propriétaire.
 *
 * Le webhook est délibérément placé AVANT les routes gardées et sans
 * `AuthGuard` : il vient du prestataire, qui ne porte pas de jeton. Sa seule
 * authentification est la signature de son corps, vérifiée par le
 * prestataire lui-même (`verifierWebhook`).
 */
@Controller('paiements')
export class PaiementController {
  constructor(private paiements: PaiementService) {}

  /**
   * Webhook du prestataire.
   *
   * ═══ 200 SEULEMENT SI L'ON A CONCLU ═══
   * Tant qu'on n'a pas pu trancher — référence illisible, prestataire
   * injoignable, ou son API encore en retard sur son propre webhook — on
   * répond **500**. C'est ce qui déclenche le rejeu.
   *
   * Acquitter par un 200 sans avoir conclu perdrait la notification
   * DÉFINITIVEMENT : elle ne serait jamais réémise. Un 500 est ici le
   * comportement correct, pas un incident.
   *
   * Le corps BRUT est transmis tel quel au prestataire, qui n'y cherche
   * qu'une référence — voir `extraireReference`. Il est capté dans
   * `main.ts`, au parseur JSON.
   */
  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Headers() entetes: Record<string, string | string[] | undefined>,
  ) {
    const brut = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const r = await this.paiements.traiterWebhook(entetes, brut);
    if (!r.conclu) {
      // 500 VOULU : seule façon d'obtenir un rejeu du prestataire.
      throw new HttpException(
        { statusCode: 500, message: `Vérification non concluante (${r.motif ?? ''}) — rejouez`, rejouer: true },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { recu: true, statut: r.statut ?? null };
  }

  /**
   * Nouvelle tentative de paiement.
   *
   * Ouvre une transaction avec une référence NEUVE : MyCoolPay refuse une
   * référence déjà employée. Le lien avec la tentative précédente est
   * conservé côté serveur.
   */
  @Post(':reference/reessayer')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  reessayer(
    @Param('reference') reference: string,
    @Body() body: { telephonePayeur?: string },
    @Req() req: Request,
  ) {
    const acteur = (req as any)['user'];
    return this.paiements.reessayer(reference, acteur.email, body?.telephonePayeur);
  }

  // ── Routes propriétaire ────────────────────────────────────────────────

  /**
   * Ouvre un paiement pour créer une boutique.
   *
   * Rien n'est créé ici : la boutique naîtra à la confirmation du paiement.
   * La réponse porte la référence à interroger et, le cas échéant, l'adresse
   * de la page de paiement.
   */
  @Post('boutique')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  demanderBoutique(@Body() body: DemandeCreationBoutique, @Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.paiements.demanderCreationBoutique(acteur.email, body);
  }

  /** Ouvre un paiement pour renouveler la licence d'une de ses boutiques. */
  @Post('renouvellement')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  demanderRenouvellement(@Body() body: { boutiqueId: string; telephonePayeur?: string }, @Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.paiements.demanderRenouvellement(acteur.email, body?.boutiqueId, body?.telephonePayeur);
  }

  /**
   * Numéro du propriétaire, pour PRÉ-REMPLIR le champ de paiement.
   *
   * Déclarée AVANT `:reference`, sinon la route générique l'absorberait —
   * Nest résout dans l'ordre de déclaration.
   *
   * Ce n'est qu'une suggestion : le payeur peut régler depuis un autre compte
   * Mobile Money, et c'est le numéro DÉBITÉ qui doit être saisi.
   */
  @Get('payeur')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  payeur(@Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.paiements.telephoneParDefaut(acteur.email);
  }

  /** Ses propres paiements — pour un historique et une reprise en cas d'abandon. */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  lister(@Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.paiements.listerPour(acteur.email);
  }

  /**
   * État d'un paiement — interrogé par l'interface pendant l'attente.
   *
   * Cette route est une LECTURE : elle échappe donc au blocage pour licence
   * expirée, comme toutes les lectures.
   */
  @Get(':reference')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('patron', 'superadmin')
  etat(@Param('reference') reference: string, @Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.paiements.parReference(reference, acteur.email);
  }
}
