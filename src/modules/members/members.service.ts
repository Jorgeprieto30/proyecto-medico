import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Member } from './entities/member.entity';
import { MemberCenterVisit } from './entities/member-center-visit.entity';
import { MailService } from '../mail/mail.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { UpdateMemberDto, ChangePasswordDto } from './dto/update-member.dto';
import { AdminCreateMemberDto } from './dto/admin-create-member.dto';

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
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    @InjectRepository(MemberCenterVisit)
    private readonly visitRepo: Repository<MemberCenterVisit>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Registra o actualiza la visita de un miembro a un centro.
   * Upsert: si ya existe el par (member, center) solo actualiza last_visited_at.
   */
  async recordVisit(memberId: string, centerUserId: string): Promise<void> {
    await this.visitRepo
      .createQueryBuilder()
      .insert()
      .into(MemberCenterVisit)
      .values({ memberId, centerUserId })
      .orUpdate(['last_visited_at'], ['member_id', 'center_user_id'])
      .execute();
  }

  /**
   * Retorna todos los miembros que alguna vez visitaron el centro del admin.
   */
  async findMyVisitors(centerUserId: string): Promise<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    rut: string | null;
    first_visited_at: Date;
    last_visited_at: Date;
  }[]> {
    const visits = await this.visitRepo.find({
      where: { centerUserId },
      relations: ['member'],
      order: { last_visited_at: 'DESC' },
    });
    return visits.map((v) => ({
      id: v.member.id,
      first_name: v.member.first_name,
      last_name: v.member.last_name,
      email: v.member.email,
      rut: v.member.rut,
      first_visited_at: v.first_visited_at,
      last_visited_at: v.last_visited_at,
    }));
  }

  async register(dto: RegisterMemberDto) {
    const normalizedRut = dto.rut ? normalizeRut(dto.rut) : null;
    if (normalizedRut && !isValidRut(normalizedRut)) {
      throw new BadRequestException('RUT inválido');
    }

    // Check if pre-registered account exists with same email (no password)
    const existing = await this.memberRepo
      .createQueryBuilder('m')
      .addSelect('m.password_hash')
      .where('m.email = :email', { email: dto.email })
      .getOne();

    if (existing) {
      if (existing.password_hash) {
        // Already has a full account → reject
        throw new ConflictException('No fue posible completar el registro. Verifica los datos e intenta nuevamente.');
      }
      // Pre-registered by admin → link: set password + complete profile
      const password_hash = await bcrypt.hash(dto.password, 12);
      await this.memberRepo.update(existing.id, {
        first_name: dto.first_name,
        last_name: dto.last_name,
        rut: normalizedRut ?? existing.rut,
        birth_date: dto.birth_date ?? existing.birth_date,
        password_hash,
      });
      const linked = await this.findById(existing.id);
      return this.buildResponse(linked!);
    }

    // Normal registration
    const password_hash = await bcrypt.hash(dto.password, 12);
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

  async login(dto: LoginMemberDto, ip?: string) {
    const member = await this.memberRepo
      .createQueryBuilder('m')
      .addSelect('m.password_hash')
      .where('m.email = :email', { email: dto.email })
      .getOne();

    if (!member || !member.password_hash) {
      this.logger.warn(`[MEMBERS] Login fallido — email no encontrado: ${dto.email} | ip: ${ip ?? 'unknown'}`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const valid = await bcrypt.compare(dto.password, member.password_hash);
    if (!valid) {
      this.logger.warn(`[MEMBERS] Login fallido — contraseña incorrecta: ${dto.email} | ip: ${ip ?? 'unknown'}`);
      throw new UnauthorizedException('Credenciales incorrectas');
    }
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

  async adminCreate(dto: AdminCreateMemberDto): Promise<Member> {
    const existing = await this.memberRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe un cliente registrado con ese email.');
    }

    let normalizedRut: string | null = null;
    if (dto.rut) {
      normalizedRut = normalizeRut(dto.rut);
      if (!isValidRut(normalizedRut)) throw new BadRequestException('RUT inválido');
      const existingRut = await this.memberRepo.findOne({ where: { rut: normalizedRut } });
      if (existingRut) throw new ConflictException('Ya existe un cliente registrado con ese RUT.');
    }

    const member = this.memberRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      rut: normalizedRut,
      birth_date: dto.birth_date ?? null,
      // no password_hash — pre-registered by admin
    });
    return this.memberRepo.save(member);
  }

  async searchMembers(q: string): Promise<Member[]> {
    if (!q || q.trim().length < 2) return [];
    const term = `%${q.trim().toLowerCase()}%`;
    return this.memberRepo
      .createQueryBuilder('m')
      .where(`LOWER(m.first_name || ' ' || m.last_name) LIKE :term`, { term })
      .orWhere('LOWER(m.rut) LIKE :term', { term })
      .orWhere('LOWER(m.email) LIKE :term', { term })
      .orderBy('m.first_name', 'ASC')
      .limit(10)
      .getMany();
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
