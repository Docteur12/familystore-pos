import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FacturesController } from './factures.controller';
import { FacturesService }    from './factures.service';
import { Facture, FactureSchema } from '../schemas/facture.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Facture.name, schema: FactureSchema }]),
  ],
  controllers: [FacturesController],
  providers:   [FacturesService],
  exports:     [FacturesService],
})
export class FacturesModule {}
