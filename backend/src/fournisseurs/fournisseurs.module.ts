import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fournisseur, FournisseurSchema } from '../schemas/fournisseur.schema';
import { FournisseursService } from './fournisseurs.service';
import { FournisseursController } from './fournisseurs.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fournisseur.name, schema: FournisseurSchema }]),
    AuthModule,
  ],
  controllers: [FournisseursController],
  providers: [FournisseursService],
  exports: [FournisseursService],
})
export class FournisseursModule {}
