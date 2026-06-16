import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AuthGuard }  from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles }      from '../auth/roles.decorator';

@Controller('categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  // Arbre catégories → sous-catégories (tout utilisateur connecté, pour les listes).
  @Get()
  getTree() {
    return this.service.getTree();
  }

  // Ajout d'une catégorie/sous-catégorie (patron uniquement).
  @Post('add')
  @UseGuards(RolesGuard)
  @Roles('patron')
  add(@Body() body: { category: string; subCategory?: string }) {
    return this.service.add(body.category, body.subCategory);
  }

  // Remplace toute la taxonomie (import CSV, patron uniquement).
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('patron')
  importAll(@Body() body: { rows: { category: string; subCategory?: string }[] }) {
    return this.service.replaceAll(body.rows ?? []);
  }
}
