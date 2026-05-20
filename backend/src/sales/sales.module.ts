import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { EcartStock, EcartStockSchema } from '../schemas/ecart-stock.schema';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name,          schema: SaleSchema          },
      { name: Product.name,       schema: ProductSchema       },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: EcartStock.name,   schema: EcartStockSchema   },
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
