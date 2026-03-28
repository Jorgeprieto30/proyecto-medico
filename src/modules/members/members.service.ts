import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Member } from './entities/member.entity';
import { MailService } from '../mail/mail.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { UpdateMemberDto, ChangePasswordDto } from './dto/update-member.dto';

function normalizeRut(rut: string): string {
  const clean = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  if (!clean.includes('-') && clean.length > 1) {
    return clean.slice(0, -1) + '-' + clean.slice(-1);
  }
  return clean;
}

function isValidRut(rut: string): boolean {
  if (!/^\d{7,8}-[\dkK]$/i.test(rut)) return false;
  const [cuerpo, dvIngresado] = rut.split('-');
  const dv = dvIngresado.toUpperCase();
  let suma = 0, multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = suma % 11;
  const dvEsperado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);
  return dv === dvEsperado;
}

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterMemberDto) {
    const existing = await this.memberRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const normalizedRut = dto.rut ? normalizeRut(dto.rut) : null;
    if (normalizedRut && !isValidRut(normalizedRut)) {
      throw new BadRequestException('RUT inválido');
    }

    const member = this.memberRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      rut: normalizedRut,
      birth_date: dto.birth_date ?? null,
      password_hash,
    });
    const saved = await this.memberRepo.save(member);
    return this.buildResponse(saved);
  }

  async login(dto: LoginMemberDto) {
    const member = await this.memberRepo
      .createQueryBuilder('m')
      .addSelect('m.password_hash')
      .where('m.email = :email', { email: dto.email })
      .getOne();

    if (!member || !member.password_hash) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const valid = await bcrypt.compare(dto.password, member.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');
    return this.buildResponse(member);
  }

  async findById(id: string): Promise<Member | null> {
    return this.memberRepo.findOne({ where: { id } });
  }

  async getProfile(id: string): Promise<Member> {
    const member = await this.findById(id);
    if (!member) throw new NotFoundException('Miembro no encontrado');
    return member;
  }

  async updateProfile(id: string, dto: UpdateMemberDto): Promise<Member> {
    const member = await this.getProfile(id);
    if (dto.first_name !== undefined) member.first_name = dto.first_name;
    if (dto.last_name !== undefined) member.last_name = dto.last_name;
    if (dto.rut !== undefined) {
      const normalizedRut = dto.rut ? normalizeRut(dto.rut) : null;
      if (normalizedRut && !isValidRut(normalizedRut)) {
        throw new BadRequestException('RUT inválido');
      }
      member.rut = normalizedRut;
    }
    if (dto.birth_date !== undefined) member.birth_date = dto.birth_date;
    return this.memberRepo.save(member);
  }

  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    const member = await this.memberRepo
      .createQueryBuilder('m')
      .addSelect('m.password_hash')
      .where('m.id = :id', { id })
      .getOne();

    if (!member || !member.password_hash) {
      throw new NotFoundException('Miembro no encontrado');
    }
    const valid = await bcrypt.compare(dto.current_password, member.password_hash);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    member.password_hash = await bcrypt.hash(dto.new_password, 12);
    await this.memberRepo.save(member);
  }

  async forgotPassword(email: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { email } });
    if (!member) return; // respuesta genérica — no revelar si el email existe

    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.memberRepo.update(member.id, {
      reset_password_token: hash,
      reset_password_expires: expires,
    });

    const frontendUrl = process.env.FRONTEND_URLS?.split(',')[0]?.trim() ?? 'http://localhost:3001';
    const resetUrl = `${frontendUrl}/portal/reset-password?token=${raw}`;

    this.mailService.sendPasswordReset({
      to: member.email,
      name: member.first_name,
      resetUrl,
      userType: 'member',
    }).catch(() => {});
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const member = await this.memberRepo
      .createQueryBuilder('m')
      .addSelect('m.reset_password_token')
      .addSelect('m.reset_password_expires')
      .where('m.reset_password_token = :hash', { hash })
      .andWhere('m.reset_password_expires > NOW()')
      .getOne();

    if (!member) throw new BadRequestException('Token inválido o expirado');

    const password_hash = await bcrypt.hash(newPassword, 12);
    await this.memberRepo.update(member.id, {
      password_hash,
      reset_password_token: null,
      reset_password_expires: null,
    });
  }

  private buildResponse(member: Member) {
    const payload = { sub: member.id, type: 'member' };
    return {
      access_token: this.jwtService.sign(payload),
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        rut: member.rut,
        birth_date: member.birth_date ?? null,
      },
    };
  }
}
