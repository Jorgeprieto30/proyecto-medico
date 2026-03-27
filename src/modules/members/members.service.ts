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
import { Member } from './entities/member.entity';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { UpdateMemberDto, ChangePasswordDto } from './dto/update-member.dto';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepo: Repository<Member>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterMemberDto) {
    const existing = await this.memberRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const password_hash = await bcrypt.hash(dto.password, 12);
    const member = this.memberRepo.create({
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      rut: dto.rut ?? null,
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
    if (dto.rut !== undefined) member.rut = dto.rut;
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
