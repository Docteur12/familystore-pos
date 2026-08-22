import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ConsolideService } from './consolide.service';
import { AuthGuard } from '../auth/auth.guard';

/**
 * Rapports consolidés du propriétaire — lecture seule.
 *
 * Le périmètre vient EXCLUSIVEMENT de `req.user.boutiques`, la liste signée
 * par le serveur à la connexion. Aucun paramètre de requête ne peut l'élargir :
 * demander une boutique absente de cette liste ne renvoie rien de plus, même
 * en connaissant son identifiant.
 *
 * Le contrôleur n'expose délibérément AUCUNE écriture.
 */
@Controller('consolide')
@UseGuards(AuthGuard)
export class ConsolideController {
  constructor(private consolideService: ConsolideService) {}

  /** Boutiques du propriétaire (identifiant + nom), pour le sélecteur. */
  @Get('boutiques')
  boutiques(@Req() req: Request) {
    return this.consolideService.boutiques((req as any)['user']?.boutiques ?? []);
  }

  @Get('rapport')
  rapport(@Req() req: Request, @Query('debut') debut?: string, @Query('fin') fin?: string) {
    const boutiques: string[] = (req as any)['user']?.boutiques ?? [];
    return this.consolideService.rapport(boutiques, debut, fin);
  }
}
