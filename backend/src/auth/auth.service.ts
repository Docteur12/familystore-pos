import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    const payload = {
      sub: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    };
  }

  async register(name: string, email: string, password: string, role: string) {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({ name, email, password: hashed, role });
    return { id: user._id, name: user.name, email: user.email, role: user.role };
  }

  async findAll() {
    return this.userModel.find().select('-password');
  }

  async updateUser(id: string, data: { name?: string; password?: string }) {
    const update: Record<string, string> = {};
    if (data.name?.trim())     update.name     = data.name.trim();
    if (data.password?.trim()) update.password = await bcrypt.hash(data.password.trim(), 10);
    if (Object.keys(update).length === 0) return this.userModel.findById(id).select('-password');
    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }
}
