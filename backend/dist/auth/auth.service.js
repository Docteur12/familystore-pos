"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bcrypt = require("bcryptjs");
const user_schema_1 = require("../schemas/user.schema");
let AuthService = class AuthService {
    constructor(userModel, jwtService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
    }
    async login(email, password) {
        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new common_1.UnauthorizedException('Email ou mot de passe incorrect');
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Email ou mot de passe incorrect');
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
    async register(name, email, password, role) {
        const existing = await this.userModel.findOne({ email: email.toLowerCase() });
        if (existing) {
            throw new common_1.ConflictException('Cet email est déjà utilisé');
        }
        const hashed = await bcrypt.hash(password, 10);
        const user = await this.userModel.create({ name, email, password: hashed, role });
        return { id: user._id, name: user.name, email: user.email, role: user.role };
    }
    async findAll() {
        return this.userModel.find().select('-password');
    }
    async updateUser(id, data) {
        const update = {};
        if (data.name?.trim())
            update.name = data.name.trim();
        if (data.password?.trim())
            update.password = await bcrypt.hash(data.password.trim(), 10);
        if (Object.keys(update).length === 0)
            return this.userModel.findById(id).select('-password');
        const user = await this.userModel
            .findByIdAndUpdate(id, update, { new: true })
            .select('-password');
        if (!user)
            throw new common_1.NotFoundException('Utilisateur introuvable');
        return user;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map