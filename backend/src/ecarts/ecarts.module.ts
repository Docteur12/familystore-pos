import { Module }         from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EcartsController } from './ecarts.controller';
import { EcartsService }    from './ecarts.service';
import { EcartStock, EcartStockSchema } from '../schemas/ecart-stock.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EcartStock.name, schema: EcartStockSchema },
    ]),
  ],
  controllers: [EcartsController],
  providers:   [EcartsService],
})
export class EcartsModule {}
