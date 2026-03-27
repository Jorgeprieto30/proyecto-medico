import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly repo: Repository<ApiKey>,
  ) {}

  async create(dto: CreateApiKeyDto, userId: string) {
    const raw = `ak_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 10);
    const key_hash = createHash('sha256').update(raw).digest('hex');

    const entity = this.repo.create({
      name: dto.name,
      prefix,
      key_hash,
      user_id: userId,
    });
    await this.repo.save(entity);

    // raw solo se devuelve UNA vez en la creación; nunca se almacena en texto plano
    return { ...entity, key: raw };
  }

  async findAllByUser(userId: string): Promise<ApiKey[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async revoke(id: string, userId: string): Promise<void> {
    const key = await this.repo.findOne({ where: { id, user_id: userId } });
    if (!key) throw new NotFoundException('API key no encontrada');
    key.is_active = false;
    await this.repo.save(key);
  }

  async validateKey(raw: string): Promise<ApiKey | null> {
    const key_hash = createHash('sha256').update(raw).digest('hex');
    const key = await this.repo
      .createQueryBuilder('k')
      .addSelect('k.key_hash')
      .leftJoinAndSelect('k.user', 'user')
      .where('k.key_hash = :key_hash AND k.is_active = true', { key_hash })
      .getOne();

    if (!key) return null;

    // Actualizar last_used_at sin bloquear la request
    this.repo.update(key.id, { last_used_at: new Date() }).catch(() => {});
    return key;
  }
}
