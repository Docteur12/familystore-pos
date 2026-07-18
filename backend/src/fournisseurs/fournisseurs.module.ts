import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fournisseur, FournisseurSchema } from '../schemas/fournisseur.schema';
import { Product, ProductSchema } from '../schemas/product.schema';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { VersementFournisseur, VersementFournisseurSchema } from '../schemas/versement-fournisseur.schema';
import { RetourFournisseur, RetourFournisseurSchema } from '../schemas/retour-fournisseur.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { StockSnapshot, StockSnapshotSchema } from '../schemas/stock-snapshot.schema';
import { FournisseursService } from './fournisseurs.service';
import { FournisseursController } from './fournisseurs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fournisseur.name,          schema: FournisseurSchema },
      { name: Product.name,              schema: ProductSchema },
      { name: Sale.name,                 schema: SaleSchema },
      { name: VersementFournisseur.name, schema: VersementFournisseurSchema },
      { name: RetourFournisseur.name,    schema: RetourFournisseurSchema },
      { name: StockMovement.name,        schema: StockMovementSchema },
      { name: StockSnapshot.name,        schema: StockSnapshotSchema },
    ]),
    AuthModule,
  ],
  controllers: [FournisseursController],
  providers: [FournisseursService],
  exports: [FournisseursService],
})
export class FournisseursModule {}
