import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ProvisionnementService } from './provisionnement.service';
import { AuthGuard } from '../auth/auth.guard';
import { contactLicence } from './contact-licence';
import { paiementEnLigneActif } from './paiement/choisir-prestataire';

/**
 * État de licence de la boutique consultée — alimente le bandeau de préavis.
 *
 * Le préavis compte autant que le blocage : personne ne doit découvrir
 * l'échéance le jour où ses saisies sont refusées.
 *
 * Porte aussi COMMENT renouveler : le contact du revendeur, et si un paiement
 * en ligne est proposé (faux en mode manuel — l'interface n'affiche alors
 * aucun bouton « payer », seulement le numéro à appeler).
 */
@Controller('licence')
@UseGuards(AuthGuard)
export class LicenceController {
  constructor(private provisionnement: ProvisionnementService) {}

  @Get('etat')
  async etat(@Req() req: Request) {
    const tenantId = (req as any)['user']?.tenantId;
    const etat = tenantId ? await this.provisionnement.etatLicence(String(tenantId)) : null;
    const renouvellement = { contact: contactLicence(), paiementEnLigne: paiementEnLigneActif() };
    // Pas de licence enregistrée : rien à signaler, rien à bloquer.
    if (!etat) return { connue: false, ...renouvellement };
    return {
      connue: true,
      expiree: etat.expiree,
      dateEcheance: etat.dateEcheance,
      joursRestants: etat.joursRestants,
      montant: etat.montant,
      devise: etat.devise,
      ...renouvellement,
    };
  }
}
