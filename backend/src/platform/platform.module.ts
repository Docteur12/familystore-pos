import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvisionnementService } from './provisionnement.service';
import { PlatformController } from './platform.controller';
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
  ],
  controllers: [PlatformController],
  providers: [ProvisionnementService],
  exports: [ProvisionnementService, MongooseModule],
})
export class PlatformModule {}
