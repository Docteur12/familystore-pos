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
      { name: User.name,         schema: UserSchema },
      { name: Settings.name,     schema: SettingsSchema },
    ]),
    AuthModule,
    MailModule,
  ],
  controllers: [PlatformController, LicenceController],
  providers: [
    ProvisionnementService,
    RelanceLicenceService,
    // Licence expirée → lecture seule. Intercepteur et non garde : une garde
    // globale s'exécuterait avant l'AuthGuard, sans req.user donc sans boutique.
    { provide: APP_INTERCEPTOR, useClass: LicenceInterceptor },
  ],
  exports: [ProvisionnementService, RelanceLicenceService, MongooseModule],
})
export class PlatformModule {}
