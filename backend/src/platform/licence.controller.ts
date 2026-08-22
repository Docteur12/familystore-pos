import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ProvisionnementService } from './provisionnement.service';
import { AuthGuard } from '../auth/auth.guard';

/**
 * État de licence de la boutique consultée — alimente le bandeau de préavis.
 *
 * Le préavis compte autant que le blocage : personne ne doit découvrir
 * l'échéance le jour où ses saisies sont refusées.
 */
@Controller('licence')
@UseGuards(AuthGuard)
export class LicenceController {
  constructor(private provisionnement: ProvisionnementService) {}

  @Get('etat')
  async etat(@Req() req: Request) {
    const tenantId = (req as any)['user']?.tenantId;
    const etat = tenantId ? await this.provisionnement.etatLicence(String(tenantId)) : null;
    // Pas de licence enregistrée : rien à signaler, rien à bloquer.
    if (!etat) return { connue: false };
    return {
      connue: true,
      expiree: etat.expiree,
      dateEcheance: etat.dateEcheance,
      joursRestants: etat.joursRestants,
      montant: etat.montant,
      devise: etat.devise,
    };
  }
}
