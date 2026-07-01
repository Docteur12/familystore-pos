import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { Partenaire, PartenaireSchema } from '../schemas/partenaire.schema';
import { Agence, AgenceSchema } from '../schemas/agence.schema';
import { LivraisonPartenaire, LivraisonPartenaireSchema } from '../schemas/livraison-partenaire.schema';
import { PaiementPartenaire, PaiementPartenaireSchema } from '../schemas/paiement-partenaire.schema';
import { CommandePartenaire, CommandePartenaireSchema } from '../schemas/commande-partenaire.schema';
import { RetourPartenaire, RetourPartenaireSchema } from '../schemas/retour-partenaire.schema';
import { PartenairesService } from './partenaires.service';
import { PartenairesController } from './partenaires.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Partenaire.name, schema: PartenaireSchema },
      { name: Agence.name, schema: AgenceSchema },
      { name: LivraisonPartenaire.name, schema: LivraisonPartenaireSchema },
      { name: PaiementPartenaire.name, schema: PaiementPartenaireSchema },
      { name: CommandePartenaire.name, schema: CommandePartenaireSchema },
      { name: RetourPartenaire.name, schema: RetourPartenaireSchema },
      { name: Product.name, schema: ProductSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    AuthModule,
  ],
  controllers: [PartenairesController],
  providers: [PartenairesService],
  exports: [PartenairesService],
})
export class PartenairesModule {}
