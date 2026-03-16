import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
