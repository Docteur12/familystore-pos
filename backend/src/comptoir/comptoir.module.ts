import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { Expense, ExpenseSchema } from '../schemas/expense.schema';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { ConditionnementSnack, ConditionnementSnackSchema } from './schemas/conditionnement-snack.schema';
import { MouvementConsigne, MouvementConsigneSchema } from './schemas/mouvement-consigne.schema';
import { ReceptionCasier, ReceptionCasierSchema } from './schemas/reception-casier.schema';
import { ComptoirService } from './comptoir.service';
import { ComptoirController } from './comptoir.controller';

/**
 * Module du profil Snack-bar (module optionnel `comptoir`).
 *
 * PHASE 1 : non importé par `app.module.ts` (fichier partagé). Il se monte
 * seul dans ses tests (`test/comptoir/`). PHASE 2 : une ligne en fin de la liste
 * `imports` de `AppModule`.
 *
 * Les schémas du noyau (`Product`, `StockMovement`, `Expense`, `Sale`) sont
 * importés tels quels — jamais modifiés — comme le fait `partenaires`.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConditionnementSnack.name, schema: ConditionnementSnackSchema },
      { name: MouvementConsigne.name,    schema: MouvementConsigneSchema },
      { name: ReceptionCasier.name,      schema: ReceptionCasierSchema },
      { name: Product.name,              schema: ProductSchema },
      { name: StockMovement.name,        schema: StockMovementSchema },
      { name: Expense.name,              schema: ExpenseSchema },
      { name: Sale.name,                 schema: SaleSchema },
    ]),
    AuthModule,
  ],
  controllers: [ComptoirController],
  providers:   [ComptoirService],
  exports:     [ComptoirService],
})
export class ComptoirModule {}
