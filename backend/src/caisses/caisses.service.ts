import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Caisse, CaisseDocument } from '../schemas/caisse.schema';
import { deriverPin, nouveauSelPin } from '../config/pin';

@Injectable()
export class CaissesService {
  constructor(@InjectModel(Caisse.name) private model: Model<CaisseDocument>) {}

  findAll() {
    // Ni pinKdf ni pinSalt dans les listes d'administration : la dérivation ne
    // sort du serveur que dans le JWT de la caisse concernée (login).
    return this.model.find().select('-pinKdf -pinSalt').sort({ code: 1 });
  }

  async findOne(id: string) {
    const c = await this.model.findById(id).select('-pinKdf -pinSalt');
    if (!c) throw new NotFoundException('Caisse introuvable');
    return c;
  }

  private champsPin(pin: string) {
    if (!/^\d{4,8}$/.test(pin)) throw new BadRequestException('Le PIN doit compter 4 à 8 chiffres');
    const pinSalt = nouveauSelPin();
    return { pinSalt, pinKdf: deriverPin(pin, pinSalt) };
  }

  async create(data: { nom: string; code: string; pin: string; ville?: string }) {
    const exists = await this.model.findOne({ code: data.code.toUpperCase() });
    if (exists) throw new ConflictException(`Le code ${data.code} est déjà utilisé`);
    const { pin, ...reste } = data;
    const doc = await this.model.create({ ...reste, ...this.champsPin(pin), code: data.code.toUpperCase() });
    const { pinKdf, pinSalt, ...safe } = doc.toObject();
    return safe;
  }

  async update(id: string, data: Partial<{ nom: string; pin: string; ville: string }>) {
    const { pin, ...reste } = data;
    const set = { ...reste, ...(pin ? this.champsPin(pin) : {}) };
    const c = await this.model.findByIdAndUpdate(id, set, { new: true }).select('-pinKdf -pinSalt');
    if (!c) throw new NotFoundException('Caisse introuvable');
    return c;
  }

  async remove(id: string) {
    const c = await this.model.findByIdAndDelete(id);
    if (!c) throw new NotFoundException('Caisse introuvable');
    return { deleted: true };
  }
}
