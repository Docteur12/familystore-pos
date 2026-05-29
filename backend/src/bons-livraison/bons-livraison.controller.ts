import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BonsLivraisonService } from './bons-livraison.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('bons-livraison')
@UseGuards(AuthGuard)
export class BonsLivraisonController {
  constructor(private readonly svc: BonsLivraisonService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  getAll() {
    return this.svc.getAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  create(@Body() body: any, @Req() req: any) {
    return this.svc.create(body, req.user.sub);
  }
}
