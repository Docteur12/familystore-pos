import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { FacturesFournisseursController } from './factures-fournisseurs.controller';
import { FacturesFournisseursService } from './factures-fournisseurs.service';
import { FactureFournisseur, FactureFournisseurSchema } from './facture-fournisseur.schema';
import { EXTRACTEUR_FACTURE, choisirExtracteur, nomExtracteurDemande } from './extracteur';
import { ExtracteurClaude } from './extracteur-claude';
import { ExtracteurSimule } from './extracteur-simule';
import { MagazinierService } from '../magazinier/magazinier.service';
import { Product, ProductSchema } from '../schemas/product.schema';
import { StockMovement, StockMovementSchema } from '../schemas/stock-movement.schema';
import { DemandeStock, DemandeStockSchema } from '../schemas/demande-stock.schema';
import { Reception, ReceptionSchema } from '../schemas/reception.schema';
import { Fournisseur, FournisseurSchema } from '../schemas/fournisseur.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FactureFournisseur.name, schema: FactureFournisseurSchema },
      // Requis par MagazinierService (réception fournisseur), réutilisé tel quel.
      { name: Product.name,       schema: ProductSchema       },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: DemandeStock.name,  schema: DemandeStockSchema  },
      { name: Reception.name,     schema: ReceptionSchema     },
      { name: Fournisseur.name,   schema: FournisseurSchema   },
    ]),
    AuthModule,
  ],
  controllers: [FacturesFournisseursController],
  providers: [
    FacturesFournisseursService,
    MagazinierService,
    ExtracteurSimule,
    // L'extracteur Claude n'est instancié que s'il est demandé : sans clé
    // d'API en développement, le module doit quand même démarrer en simulé.
    {
      provide: EXTRACTEUR_FACTURE,
      inject: [ExtracteurSimule],
      useFactory: (simule: ExtracteurSimule) =>
        choisirExtracteur({ claude: nomExtracteurDemande() === 'claude' ? new ExtracteurClaude() : undefined, simule }),
    },
  ],
})
export class FacturesFournisseursModule {}
