import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { DemandesBoutiqueService, NouvelleDemandeBoutique } from './demandes-boutique.service';

/**
 * Demandes d'ouverture — côté patron.
 *
 * Le patron demande une boutique de plus et suit SES demandes. L'acceptation
 * et le refus sont dans le back-office (`platform.controller.ts`, superadmin).
 */
@Controller('demandes-boutique')
@UseGuards(AuthGuard, RolesGuard)
@Roles('patron')
export class DemandesBoutiqueController {
  constructor(private demandes: DemandesBoutiqueService, private auditService: AuditService) {}

  @Post()
  async demander(@Body() body: NouvelleDemandeBoutique, @Req() req: Request) {
    const acteur = (req as any)['user'];
    const demande = await this.demandes.creer({ email: acteur.email, name: acteur.name }, body);
    this.auditService.log({
      type: 'creation', module: 'plateforme',
      actorName: acteur.name, actorRole: acteur.role,
      detail: `Demande d'ouverture de la boutique « ${demande.nom} »`,
      meta: { demandeId: demande.id },
    });
    return demande;
  }

  @Get('mes')
  mes(@Req() req: Request) {
    const acteur = (req as any)['user'];
    return this.demandes.listerPour(acteur.email);
  }
}
