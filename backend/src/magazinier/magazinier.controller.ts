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

  // Toutes les réceptions (optionnel ?userId=xxx)
  @Get('receptions')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  getAllReceptions(@Query('userId') userId?: string) {
    return this.svc.getAllReceptions(userId);
  }

  // Voir les demandes (?statut=en_attente|envoyé|reçu, défaut: en_attente)
  @Get('demandes')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  getDemandes(@Query('statut') statut?: string) {
    return this.svc.getDemandes(statut || 'en_attente');
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

  // Gestionnaire confirme la réception
  @Patch('demandes/:id/recevoir')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  marquerRecu(@Param('id') id: string) {
    return this.svc.marquerRecu(id);
  }

  // Envoi direct du magazinier vers le gestionnaire
  @Post('envois')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  createEnvoi(@Body() body: any, @Req() req: any) {
    return this.svc.createEnvoi(body, req.user.sub);
  }

  // Réinitialisation entrepôt (admin/patron uniquement)
  @Post('reset-entrepot')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  resetEntrepot() {
    return this.svc.resetEntrepot();
  }

  // Ajustement manuel du stock entrepôt (admin/patron uniquement, pas le magazinier)
  @Patch('produits/:id/stock-entrepot')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  ajusterStockEntrepot(@Param('id') id: string, @Body() body: { stockMagazin: number }) {
    return this.svc.ajusterStockEntrepot(id, body.stockMagazin);
  }

  // Historique du magazinier
  @Get('historique')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  getHistorique(@Req() req: any) {
    return this.svc.getHistorique(req.user.sub);
  }
}
