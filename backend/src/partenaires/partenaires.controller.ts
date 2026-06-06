import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PartenairesService } from './partenaires.service';
import { AuthGuard }  from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Controller('partenaires')
@UseGuards(AuthGuard, RolesGuard)
@Roles('magazinier', 'patron')
export class PartenairesController {
  constructor(private readonly service: PartenairesService) {}

  // ── Partenaires ────────────────────────────────────────────────────────────
  @Get()
  list() {
    return this.service.getPartenaires();
  }

  @Post()
  create(@Body() dto: { name: string; phone?: string; lieu?: string; note?: string }) {
    return this.service.createPartenaire(dto);
  }

  // ── Livraisons (déclaré avant :id pour éviter le conflit de route) ─────────
  @Get('livraisons')
  livraisons(@Query('partenaireId') partenaireId?: string) {
    return this.service.getLivraisons(partenaireId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<{ name: string; phone: string; lieu: string; note: string }>) {
    return this.service.updatePartenaire(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deletePartenaire(id);
  }

  @Get(':id/dernier-prix')
  dernierPrix(@Param('id') id: string) {
    return this.service.getDernierPrix(id);
  }

  @Post(':id/livraisons')
  createLivraison(
    @Param('id') id: string,
    @Body() body: { numeroBL?: string; date?: string; montantPaye?: number; lignes: { productId: string; quantite: number; prixUnitaire: number }[] },
    @Req() req: Request,
  ) {
    const actor = (req as any).user;
    return this.service.createLivraison(id, body, actor?.sub);
  }
}
