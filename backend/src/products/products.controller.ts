import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthGuard }    from '../auth/auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private auditService: AuditService,
  ) {}

  // GET /api/products?search=xxx — tous les rôles
  @Get()
  findAll(@Query('search') search?: string) {
    return this.productsService.findAll(search);
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
  async create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.create(dto);
    this.auditService.log({
      type: 'creation', module: 'produits',
      actorName: actor.name, actorRole: actor.role,
      detail: `Produit créé : ${dto.name}`,
      meta: { productId: String(result._id), price: dto.price, category: dto.category },
    });
    return result;
  }

  // PATCH /api/products/:id — patron + gestionnaire
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.update(id, dto);
    this.auditService.log({
      type: 'modification', module: 'produits',
      actorName: actor.name, actorRole: actor.role,
      detail: `Produit modifié : ${result.name}`,
      meta: { productId: id, fields: Object.keys(dto) },
    });
    return result;
  }

  // PATCH /api/products/:id/stock/add — patron et gestionnaire uniquement
  @Patch(':id/stock/add')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  async addStock(@Param('id') id: string, @Body('quantity') quantity: number, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.addStock(id, quantity);
    this.auditService.log({
      type: 'modification', module: 'stock',
      actorName: actor.name, actorRole: actor.role,
      detail: `Stock ajouté : +${quantity} ${result.name}`,
      meta: { productId: id, quantity, newStock: result.stock },
    });
    return result;
  }

  // DELETE /api/products/:id — patron + gestionnaire
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.remove(id);
    this.auditService.log({
      type: 'suppression', module: 'produits',
      actorName: actor.name, actorRole: actor.role,
      detail: `Produit supprimé : ${(result as any).message ?? id}`,
      meta: { productId: id },
    });
    return result;
  }
}
