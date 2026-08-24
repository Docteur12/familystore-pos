import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
  ) {}

  async get(): Promise<SettingsDocument> {
    let doc = await this.settingsModel.findOne().lean();
    if (!doc) {
      // Crée le document singleton avec les valeurs par défaut
      doc = await this.settingsModel.create({});
    }
    return doc as SettingsDocument;
  }

  async update(data: Partial<Settings>): Promise<SettingsDocument> {
    // Le nom du magasin ne peut pas être effacé : il s'imprime sur chaque
    // ticket, et un reçu sans nom de commerce n'est pas utilisable par le
    // client. On refuse l'effacement plutôt que de retomber sur une valeur
    // par défaut — il n'y en a plus, et il ne doit pas y en avoir.
    if ('nomMagasin' in data && !String(data.nomMagasin ?? '').trim()) {
      throw new BadRequestException(
        'Le nom du magasin est obligatoire : il figure sur tous les tickets.',
      );
    }

    const doc = await this.settingsModel.findOneAndUpdate(
      {},
      { $set: data },
      { new: true, upsert: true },
    );
    return doc!;
  }
}
