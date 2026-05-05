import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Caisse, CaisseDocument } from '../schemas/caisse.schema';

@Injectable()
export class CaissesService {
  constructor(@InjectModel(Caisse.name) private model: Model<CaisseDocument>) {}

  findAll() {
    return this.model.find().sort({ code: 1 });
  }

  async findOne(id: string) {
    const c = await this.model.findById(id);
    if (!c) throw new NotFoundException('Caisse introuvable');
    return c;
  }

  async create(data: { nom: string; code: string; pin: string; ville?: string }) {
    const exists = await this.model.findOne({ code: data.code.toUpperCase() });
    if (exists) throw new ConflictException(`Le code ${data.code} est déjà utilisé`);
    return this.model.create({ ...data, code: data.code.toUpperCase() });
  }

  async update(id: string, data: Partial<{ nom: string; pin: string; ville: string }>) {
    const c = await this.model.findByIdAndUpdate(id, data, { new: true });
    if (!c) throw new NotFoundException('Caisse introuvable');
    return c;
  }

  async remove(id: string) {
    const c = await this.model.findByIdAndDelete(id);
    if (!c) throw new NotFoundException('Caisse introuvable');
    return { deleted: true };
  }
}
