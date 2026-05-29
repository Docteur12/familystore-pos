import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MagazinierController } from './magazinier.controller';
import { MagazinierService } from './magazinier.service';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { DemandeStock, DemandeStockSchema } from '../schemas/demande-stock.schema';
import { Reception, ReceptionSchema } from '../schemas/reception.schema';
import { Fournisseur, FournisseurSchema } from '../schemas/fournisseur.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name,       schema: ProductSchema       },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: DemandeStock.name,  schema: DemandeStockSchema  },
      { name: Reception.name,     schema: ReceptionSchema     },
      { name: Fournisseur.name,   schema: FournisseurSchema   },
    ]),
    AuthModule,
  ],
  controllers: [MagazinierController],
  providers:   [MagazinierService],
})
export class MagazinierModule {}
