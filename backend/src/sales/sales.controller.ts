import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request }       from 'express';
import { SalesService }  from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuthGuard }     from '../auth/auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';
import { AuditService }  from '../audit/audit.service';

@Controller('sales')
@UseGuards(AuthGuard)
export class SalesController {
  constructor(
    private salesService: SalesService,
    private auditService: AuditService,
  ) {}

  // POST /api/sales — tous les rôles
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSaleDto, @Req() req: Request) {
    const actor  = (req as any)['user'];
    const result = await this.salesService.create(dto, actor);
    const nbItems = dto.items.reduce((s, i) => s + i.quantity, 0);
    this.auditService.log({
      type: 'vente', module: 'ventes',
      actorName: actor.name, actorRole: actor.role,
      detail: `Vente #${String(result.sale._id).slice(-6).toUpperCase()} · ${dto.total.toLocaleString('fr-FR')} XAF · ${nbItems} article${nbItems > 1 ? 's' : ''}`,
      meta: {
        saleId:        String(result.sale._id),
        total:         dto.total,
        paymentMethod: dto.paymentMethod,
        nbItems,
      },
    });
    return result;
  }

  // ── Stats (déclarés AVANT /:id pour éviter le conflit de route) ────────────

  @Get('stats/today')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsToday() { return this.salesService.statsToday(); }

  @Get('stats/week')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsWeek() { return this.salesService.statsWeek(); }

  @Get('stats/top-products')
  @UseGuards(RolesGuard)
  @Roles('patron')
  topProducts() { return this.salesService.topProducts(); }

  @Get('stats/recent')
  @UseGuards(RolesGuard)
  @Roles('patron')
  recentToday() { return this.salesService.recentToday(); }

  @Get('stats/period')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsPeriod(@Query('days') days?: string) {
    return this.salesService.statsPeriod(days ? parseInt(days) : 7);
  }

  @Get('stats/payment')
  @UseGuards(RolesGuard)
  @Roles('patron')
  paymentBreakdown(@Query('scope') scope?: string) {
    return this.salesService.paymentBreakdown(scope === 'today' ? 'today' : 'week');
  }

  // GET /api/sales — historique complet (patron)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?:   string,
  ) {
    return this.salesService.findAll({ dateFrom, dateTo });
  }

  // GET /api/sales/:id — détail d'une vente (patron + caissier)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
