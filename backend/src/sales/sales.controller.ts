import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('sales')
@UseGuards(AuthGuard)          // JWT requis sur toutes les routes
export class SalesController {
  constructor(private salesService: SalesService) {}

  // POST /api/sales — tous les rôles (caissier enregistre la vente)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  // GET /api/sales/stats/today — patron only
  // Déclaré AVANT /:id pour éviter que "today" soit capturé comme paramètre
  @Get('stats/today')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsToday() {
    return this.salesService.statsToday();
  }

  // GET /api/sales/stats/week — patron only
  @Get('stats/week')
  @UseGuards(RolesGuard)
  @Roles('patron')
  statsWeek() {
    return this.salesService.statsWeek();
  }

  // GET /api/sales/stats/top-products — patron only
  @Get('stats/top-products')
  @UseGuards(RolesGuard)
  @Roles('patron')
  topProducts() {
    return this.salesService.topProducts();
  }

  // GET /api/sales — patron only
  @Get()
  @UseGuards(RolesGuard)
  @Roles('patron')
  findAll() {
    return this.salesService.findAll();
  }
}
