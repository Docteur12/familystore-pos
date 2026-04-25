import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('products')
@UseGuards(AuthGuard)   // toutes les routes nécessitent un JWT valide
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // GET /api/products — tous les rôles
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // GET /api/products/barcode/:code — tous les rôles
  @Get('barcode/:code')
  findByBarcode(@Param('code') code: string) {
    return this.productsService.findByBarcode(code);
  }

  // GET /api/products/:id — tous les rôles
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  // POST /api/products — patron + gestionnaire
  @Post()
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // PATCH /api/products/:id — patron + gestionnaire
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  // PATCH /api/products/:id/stock/add — tous les rôles (caissier peut réceptionner du stock)
  @Patch(':id/stock/add')
  addStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.productsService.addStock(id, quantity);
  }

  // DELETE /api/products/:id — patron only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('patron')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
