import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name,       schema: ProductSchema       },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    AuthModule,
  ],
  controllers: [StockController],
  providers:   [StockService],
  exports:     [StockService],
})
export class StockModule {}
