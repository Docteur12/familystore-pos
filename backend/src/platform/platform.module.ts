import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvisionnementService } from './provisionnement.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PlatformController } from './platform.controller';
import { LicenceController } from './licence.controller';
import { LicenceInterceptor } from './licence.interceptor';
import { RelanceLicenceService } from './relance-licence.service';
import { MailModule } from '../mail/mail.module';
import { AuthModule } from '../auth/auth.module';
import { Proprietaire, ProprietaireSchema } from './schemas/proprietaire.schema';
import { Boutique, BoutiqueSchema } from './schemas/boutique.schema';
import { Licence, LicenceSchema } from './schemas/licence.schema';
import { Paiement, PaiementSchema } from './paiement/paiement.schema';
import { DemandeBoutique, DemandeBoutiqueSchema } from './schemas/demande-boutique.schema';
import { DemandesBoutiqueService } from './demandes-boutique.service';
import { DemandesBoutiqueController } from './demandes-boutique.controller';
import { PaiementService } from './paiement/paiement.service';
import { PaiementController } from './paiement/paiement.controller';
import { ReconciliationService } from './paiement/reconciliation.service';
import { PaiementSimuleProvider } from './paiement/paiement-simule.provider';
import { MyCoolPayProvider } from './paiement/mycoolpay.provider';
import { PaiementManuelProvider } from './paiement/paiement-manuel.provider';
import { PAYMENT_PROVIDER } from './paiement/payment-provider';
import { choisirPrestataire } from './paiement/choisir-prestataire';
import { User, UserSchema } from '../schemas/user.schema';
import { Settings, SettingsSchema } from '../settings/settings.schema';

/**
 * Module plateforme — au-dessus des boutiques.
 *
 * Global : la garde de licence et la résolution des boutiques d'un
 * propriétaire sont consultées depuis l'authentification et depuis toute
 * requête écrivante, sans import explicite module par module.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Proprietaire.name, schema: ProprietaireSchema },
      { name: Boutique.name,     schema: BoutiqueSchema },
      { name: Licence.name,      schema: LicenceSchema },
      { name: Paiement.name,     schema: PaiementSchema },
      { name: DemandeBoutique.name, schema: DemandeBoutiqueSchema },
      { name: User.name,         schema: UserSchema },
      { name: Settings.name,     schema: SettingsSchema },
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [PlatformController, LicenceController, PaiementController, DemandesBoutiqueController],
  providers: [
    ProvisionnementService,
    RelanceLicenceService,
    PaiementService,
    ReconciliationService,
    DemandesBoutiqueService,
    // Prestataire de paiement, choisi par PAIEMENT_FOURNISSEUR — « manuel »
    // par défaut : les licences sont activées par le superadmin après un
    // règlement de la main à la main. Le mode simulé est REFUSÉ en production
    // (le démarrage échoue) : il confirme les paiements sans encaissement, et
    // une variable oubliée sur Render rendrait les licences gratuites sans
    // que rien ne le signale.
    PaiementSimuleProvider,
    MyCoolPayProvider,
    PaiementManuelProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [PaiementSimuleProvider, MyCoolPayProvider, PaiementManuelProvider],
      useFactory: (simule: PaiementSimuleProvider, mycoolpay: MyCoolPayProvider, manuel: PaiementManuelProvider) =>
        choisirPrestataire({ simule, mycoolpay, manuel }),
    },
    // Licence expirée → lecture seule. Intercepteur et non garde : une garde
    // globale s'exécuterait avant l'AuthGuard, sans req.user donc sans boutique.
    { provide: APP_INTERCEPTOR, useClass: LicenceInterceptor },
  ],
  exports: [
    ProvisionnementService, RelanceLicenceService, DemandesBoutiqueService,
    PaiementService, ReconciliationService, PaiementSimuleProvider,
    MongooseModule,
  ],
})
export class PlatformModule {}
