import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { AddStockDto } from './dto/add-stock.dto';
import { RemoveStockDto } from './dto/remove-stock.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('stock')
@UseGuards(AuthGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  // POST /api/stock/add — gestionnaire + patron
  @Post('add')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  addStock(@Body() dto: AddStockDto) {
    return this.stockService.addStock(dto);
  }

  // POST /api/stock/remove — gestionnaire + patron
  @Post('remove')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  removeStock(@Body() dto: RemoveStockDto) {
    return this.stockService.removeStock(dto);
  }

  // GET /api/stock/low — tous les rôles authentifiés
  @Get('low')
  getLowStock() {
    return this.stockService.getLowStock();
  }

  // GET /api/stock/movements?productId=xxx — gestionnaire + patron
  @Get('movements')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  getMovements(@Query('productId') productId?: string) {
    return this.stockService.getMovements(productId);
  }

  // GET /api/stock/:productId — gestionnaire + patron
  @Get(':productId')
  @UseGuards(RolesGuard)
  @Roles('gestionnaire', 'patron')
  getProductStock(@Param('productId') productId: string) {
    return this.stockService.getProductStock(productId);
  }
}
