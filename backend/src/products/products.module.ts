import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from '../schemas/product.schema';
import { Settings, SettingsSchema } from '../settings/settings.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name,  schema: ProductSchema  },
      // Lu à la création d'un produit : règle métier « suivi des péremptions ».
      { name: Settings.name, schema: SettingsSchema },
    ]),
    AuthModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
