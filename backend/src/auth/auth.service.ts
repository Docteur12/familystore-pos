import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
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

  async register(name: string, email: string, password: string, role: string, phone?: string) {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.userModel.create({ name, email, password: hashed, role, phone: phone ?? '' });
    return { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone };
  }

  async findAll() {
    return this.userModel.find().select('-password');
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return { deleted: true };
  }

  async updateUser(id: string, data: { name?: string; email?: string; phone?: string; password?: string; oldPassword?: string }) {
    // Verify old password if changing password
    if (data.password) {
      const user = await this.userModel.findById(id);
      if (!user) throw new NotFoundException('Utilisateur introuvable');
      if (data.oldPassword) {
        const isMatch = await bcrypt.compare(data.oldPassword, user.password);
        if (!isMatch) throw new BadRequestException('Ancien mot de passe incorrect');
      }
    }

    const update: Record<string, string> = {};
    if (data.name?.trim())     update.name     = data.name.trim();
    if (data.email?.trim())    update.email    = data.email.toLowerCase().trim();
    if (data.phone !== undefined) update.phone = data.phone.trim();
    if (data.password?.trim()) update.password = await bcrypt.hash(data.password.trim(), 10);

    if (Object.keys(update).length === 0) return this.userModel.findById(id).select('-password');
    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) throw new NotFoundException('Aucun compte associé à cet email');

    // Generate a random temp password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Family Store POS" <${process.env.MAIL_USER}>`,
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe — Family Store POS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #7A1D2E;">Family Store POS</h2>
          <p>Bonjour <strong>${user.name}</strong>,</p>
          <p>Votre mot de passe temporaire est :</p>
          <div style="background: #f5f0e8; padding: 16px; border-radius: 8px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 0.1em; color: #7A1D2E; font-family: monospace;">
            ${tempPassword}
          </div>
          <p style="margin-top: 16px; color: #666;">Connectez-vous avec ce mot de passe, puis changez-le immédiatement depuis les paramètres de votre compte.</p>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">Family Store POS — by RDCT</p>
        </div>
      `,
    });

    return { message: 'Un mot de passe temporaire a été envoyé à votre adresse email.' };
  }
}
