import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password_hash,
      avatar_url: dto.avatar_url,
    });
    return this.userRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async updateProfile(
    id: string,
    data: { center_name?: string; center_code?: string },
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (data.center_code !== undefined) {
      const existing = await this.userRepo.findOne({
        where: { center_code: data.center_code, id: Not(id) },
      });
      if (existing) throw new ConflictException('El código de centro ya está en uso');
      user.center_code = data.center_code || null;
    }
    if (data.center_name !== undefined) {
      user.center_name = data.center_name || null;
    }
    return this.userRepo.save(user);
  }

  async findByCenterCode(code: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { center_code: code } });
  }

  async searchCenters(q: string): Promise<User[]> {
    return this.userRepo.find({
      where: [
        { center_name: ILike(`%${q}%`) },
        { center_code: ILike(`%${q}%`) },
      ],
      select: ['id', 'center_name', 'center_code'],
    });
  }

  async findOrCreateGoogleUser(data: {
    google_id: string;
    email: string;
    name: string;
    avatar_url?: string;
  }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { google_id: data.google_id } });
    if (!user) {
      user = await this.userRepo.findOne({ where: { email: data.email } });
    }
    if (!user) {
      user = this.userRepo.create(data);
      await this.userRepo.save(user);
    } else if (!user.google_id) {
      user.google_id = data.google_id;
      if (data.avatar_url) user.avatar_url = data.avatar_url;
      await this.userRepo.save(user);
    }
    return user;
  }
}
