import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.buildResponse(user);
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.password_hash) {
      this.logger.warn(`[AUTH] Login fallido — email no encontrado: ${dto.email} | ip: ${ip ?? 'unknown'}`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      this.logger.warn(`[AUTH] Login fallido — contraseña incorrecta: ${dto.email} | ip: ${ip ?? 'unknown'}`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    return this.buildResponse(user);
  }

  async googleLogin(googleUser: {
    google_id: string;
    email: string;
    name: string;
    avatar_url?: string;
  }) {
    const user = await this.usersService.findOrCreateGoogleUser(googleUser);
    return this.buildResponse(user);
  }

  private buildResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return; // respuesta genérica — no revelar si el email existe

    const { raw, hash } = this.usersService.generateResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await this.usersService.setResetToken(user.id, hash, expires);

    const frontendUrl = process.env.FRONTEND_URLS?.split(',')[0]?.trim() ?? 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/reset-password?token=${raw}`;

    this.mailService.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl,
      userType: 'admin',
    }).catch(() => {});
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(token).digest('hex');
    const user = await this.usersService.findByResetToken(hash);
    if (!user) throw new BadRequestException('Token inválido o expirado');
    await this.usersService.resetPassword(user.id, newPassword);
  }

  async validateUser(payload: { sub: string }) {
    return this.usersService.findById(payload.sub);
  }
}
