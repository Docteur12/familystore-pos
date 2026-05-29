import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { BonLivraison, BonLivraisonSchema } from '../schemas/bon-livraison.schema';
import { BonsLivraisonService } from './bons-livraison.service';
import { BonsLivraisonController } from './bons-livraison.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BonLivraison.name, schema: BonLivraisonSchema },
      { name: Product.name, schema: ProductSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    AuthModule,
  ],
  controllers: [BonsLivraisonController],
  providers: [BonsLivraisonService],
  exports: [BonsLivraisonService],
})
export class BonsLivraisonModule {}
