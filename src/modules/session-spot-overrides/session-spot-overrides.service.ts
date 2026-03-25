import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionSpotOverride } from './entities/session-spot-override.entity';

@Injectable()
export class SessionSpotOverridesService {
  constructor(
    @InjectRepository(SessionSpotOverride)
    private readonly repo: Repository<SessionSpotOverride>,
  ) {}

  async upsert(serviceId: string, slotStart: Date, maxSpots: number): Promise<SessionSpotOverride> {
    const existing = await this.repo.findOne({ where: { serviceId, slotStart } });
    if (existing) {
      existing.maxSpots = maxSpots;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ serviceId, slotStart, maxSpots }));
  }

  async findByServiceAndSlot(serviceId: string, slotStart: Date): Promise<SessionSpotOverride | null> {
    return this.repo.findOne({ where: { serviceId, slotStart } });
  }

  async findByServiceAndDateRange(
    serviceId: string,
    startUtc: Date,
    endUtc: Date,
  ): Promise<SessionSpotOverride[]> {
    return this.repo
      .createQueryBuilder('o')
      .where('o.service_id = :serviceId', { serviceId })
      .andWhere('o.slot_start >= :start', { start: startUtc })
      .andWhere('o.slot_start < :end', { end: endUtc })
      .getMany();
  }

  /** Elimina todos los overrides de un servicio (cuando cambia max_spots general). */
  async deleteAllByServiceId(serviceId: string): Promise<void> {
    await this.repo.delete({ serviceId });
  }

  async deleteByServiceAndSlot(serviceId: string, slotStart: Date): Promise<void> {
    await this.repo.delete({ serviceId, slotStart });
  }
}
