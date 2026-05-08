import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsController } from './sessions.controller';
import { SessionsService }    from './sessions.service';
import { CaisseSession, CaisseSessionSchema } from '../schemas/session.schema';
import { Sale, SaleSchema } from '../schemas/sale.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaisseSession.name, schema: CaisseSessionSchema },
      { name: Sale.name,          schema: SaleSchema          },
    ]),
  ],
  controllers: [SessionsController],
  providers:   [SessionsService],
  exports:     [SessionsService],
})
export class SessionsModule {}
