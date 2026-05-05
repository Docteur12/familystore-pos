import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Caisse, CaisseSchema } from '../schemas/caisse.schema';
import { CaissesService } from './caisses.service';
import { CaissesController } from './caisses.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Caisse.name, schema: CaisseSchema }]),
    AuthModule,
  ],
  controllers: [CaissesController],
  providers: [CaissesService],
  exports: [CaissesService],
})
export class CaissesModule {}
