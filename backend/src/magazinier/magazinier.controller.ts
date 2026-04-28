import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { MagazinierService } from './magazinier.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('magazinier')
@UseGuards(AuthGuard)
export class MagazinierController {
  constructor(private readonly svc: MagazinierService) {}

  // Accessible par magazinier + gestionnaire + patron
  @Post('receptions')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  createReception(@Body() body: any, @Req() req: any) {
    return this.svc.createReception(body, req.user.sub);
  }

  // Voir les demandes (en_attente par défaut, ?statut=all pour tout)
  @Get('demandes')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  getDemandes(@Query('statut') statut?: string) {
    return this.svc.getDemandes(statut === 'all' ? undefined : 'en_attente');
  }

  // Créé par le gestionnaire / patron
  @Post('demandes')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  createDemande(@Body() body: any, @Req() req: any) {
    return this.svc.createDemande(body, req.user.sub);
  }

  // Magazinier marque comme envoyé
  @Patch('demandes/:id/envoyer')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  marquerEnvoye(@Param('id') id: string) {
    return this.svc.marquerEnvoye(id);
  }

  // Historique du magazinier
  @Get('historique')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  getHistorique(@Req() req: any) {
    return this.svc.getHistorique(req.user.sub);
  }
}
