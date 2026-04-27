import { Injectable } from '@nestjs/common';
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
    const doc = await this.settingsModel.findOneAndUpdate(
      {},
      { $set: data },
      { new: true, upsert: true },
    );
    return doc!;
  }
}
