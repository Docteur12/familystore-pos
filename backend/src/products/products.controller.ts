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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
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

  // GET /api/products/export-excel — catalogue complet en fichier Excel (.xlsx)
  @Get('export-excel')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire', 'magazinier')
  async exportExcel(@Res() res: Response) {
    const buf = await this.productsService.exportExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=produits_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buf);
  }

  // POST /api/products/parse-excel — lit un .xlsx (base64) et renvoie les lignes
  @Post('parse-excel')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire', 'magazinier')
  parseExcel(@Body() body: { fileBase64: string }) {
    return this.productsService.parseExcel(body?.fileBase64 ?? '');
  }

  // GET /api/products/:id — tous les rôles
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  // POST /api/products/import-bulk — import Excel/CSV en masse
  @Post('import-bulk')
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire', 'magazinier')
  async importBulk(@Body() body: { rows: Array<Record<string, unknown>> }, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.importBulk(Array.isArray(body?.rows) ? body.rows : []);
    this.auditService.log({
      type: 'modification', module: 'produits',
      actorName: actor.name, actorRole: actor.role,
      detail: `Import produits en masse : ${result.crees} créé(s), ${result.modifies} modifié(s), ${result.erreurs.length} erreur(s)`,
      meta: { crees: result.crees, modifies: result.modifies, erreurs: result.erreurs.length },
    });
    return result;
  }

  // POST /api/products — patron + gestionnaire + magasinier
  @Post()
  @UseGuards(RolesGuard)
  @Roles('patron', 'gestionnaire', 'magazinier')
  async create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const actor = (req as any)['user'];
    const result = await this.productsService.create(dto, actor);
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

  // PATCH /api/products/:id/prix — magasinier + gestionnaire + patron
  // Fixe les prix et les verrouille (le gestionnaire ne pourra plus les changer)
  @Patch(':id/prix')
  @UseGuards(RolesGuard)
  @Roles('magazinier', 'gestionnaire', 'patron')
  async setPrix(
    @Param('id') id: string,
    @Body('price') price: number,
    @Body('costPrice') costPrice: number,
    @Req() req: Request,
  ) {
    const actor = (req as any)['user'];
    const result = await this.productsService.setPrix(id, Number(price) || 0, Number(costPrice) || 0, actor?.name, actor?.role);
    this.auditService.log({
      type: 'modification', module: 'produits',
      actorName: actor.name, actorRole: actor.role,
      detail: `Prix fixé : ${result.name} — achat ${result.costPrice} / vente ${result.price} XAF`,
      meta: { productId: id, price: result.price, costPrice: result.costPrice },
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
