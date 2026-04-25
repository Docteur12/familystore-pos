import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SalesService }    from './sales.service';
import { CreateSaleDto }   from './dto/create-sale.dto';
import { AuthGuard }       from '../auth/auth.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';

@Controller('sales')
@UseGuards(AuthGuard)
export class SalesController {
  constructor(private salesService: SalesService) {}

  // POST /api/sales — tous les rôles (caissier enregistre la vente)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
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

  // GET /api/sales — historique complet (patron)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll() { return this.salesService.findAll(); }

  // GET /api/sales/:id — détail d'une vente (patron + caissier)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
