import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsolideController } from './consolide.controller';
import { ConsolideService } from './consolide.service';
import { Sale, SaleSchema } from '../schemas/sale.schema';
import { Settings, SettingsSchema } from '../settings/settings.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sale.name,     schema: SaleSchema },
      { name: Settings.name, schema: SettingsSchema },
    ]),
    AuthModule,
  ],
  controllers: [ConsolideController],
  providers: [ConsolideService],
})
export class ConsolideModule {}
