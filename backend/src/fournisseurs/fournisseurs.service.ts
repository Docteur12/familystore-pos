import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fournisseur, FournisseurDocument } from '../schemas/fournisseur.schema';

type FournisseurData = {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  adresse?: string;
  conditionsPaiement?: string;
  remise?: string;
  note?: number;
  categories?: string[];
};

const DEFAULTS: FournisseurData[] = [
  { name: 'Import Maroc',      contact: 'Ahmed B.',    phone: '+212 6XX XXX XXX', email: 'import@maroc.ma',   adresse: 'Casablanca, Maroc',  conditionsPaiement: '30j',      remise: '5',  note: 4, categories: ['beauté', 'bien-être'] },
  { name: 'Soleco SA',         contact: 'Marie C.',    phone: '+237 6XX XXX XXX', email: 'soleco@cm.net',     adresse: 'Douala, Cameroun',   conditionsPaiement: 'comptant', remise: '3',  note: 5, categories: ['hygiène'] },
  { name: 'Import France',     contact: 'Pierre D.',   phone: '+33 6XX XXX XXX',  email: 'import@france.fr',  adresse: 'Paris, France',      conditionsPaiement: '60j',      remise: '8',  note: 3, categories: ['parfumerie'] },
  { name: 'Coop. Cameroun',    contact: 'Jean F.',     phone: '+237 6XX XXX XXX', email: 'coop@cameroun.cm',  adresse: 'Yaoundé, Cameroun',  conditionsPaiement: 'comptant', remise: '0',  note: 4, categories: ['épicerie'] },
  { name: 'Coop. Douala',      contact: 'Paul N.',     phone: '+237 6XX XXX XXX', email: 'coop@douala.cm',    adresse: 'Akwa, Douala',       conditionsPaiement: '30j',      remise: '2',  note: 4, categories: ['alimentation'] },
  { name: 'SABC',              contact: 'Responsable', phone: '+237 2XX XXX XXX', email: 'sabc@sabc.cm',      adresse: 'Bassa, Douala',      conditionsPaiement: '30j',      remise: '10', note: 5, categories: ['boissons'] },
  { name: 'Fournisseur Local', contact: 'N/A',         phone: '+237 6XX XXX XXX', email: '',                  adresse: 'Douala, Cameroun',   conditionsPaiement: 'comptant', remise: '0',  note: 2, categories: ['maison'] },
];

@Injectable()
export class FournisseursService {
  constructor(@InjectModel(Fournisseur.name) private model: Model<FournisseurDocument>) {}

  async findAll() {
    const count = await this.model.estimatedDocumentCount();
    if (count === 0) await this.model.insertMany(DEFAULTS);
    return this.model.find().sort({ name: 1 });
  }

  async create(data: FournisseurData) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<FournisseurData>) {
    const f = await this.model.findByIdAndUpdate(id, data, { new: true });
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    return f;
  }

  async remove(id: string) {
    const f = await this.model.findByIdAndDelete(id);
    if (!f) throw new NotFoundException('Fournisseur introuvable');
    return { deleted: true };
  }
}
