import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SessionSpotOverridesService } from '../session-spot-overrides/session-spot-overrides.service';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    private readonly sessionOverridesService: SessionSpotOverridesService,
  ) {}

  async create(dto: CreateServiceDto, userId: string): Promise<Service> {
    const service = this.serviceRepo.create({
      ...dto,
      isActive: dto.isActive ?? true,
      userId,
    });
    return this.serviceRepo.save(service);
  }

  async findAll(userId: string): Promise<Service[]> {
    return this.serviceRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { id } });
    if (!service) {
      throw new NotFoundException(`Servicio con id ${id} no encontrado`);
    }
    return service;
  }

  async findOneForUser(id: string, userId: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({ where: { id, userId } });
    if (!service) {
      throw new NotFoundException(`Servicio con id ${id} no encontrado`);
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto, userId: string): Promise<Service> {
    const service = await this.findOneForUser(id, userId);
    const maxSpotsChanged =
      dto.maxSpots !== undefined && dto.maxSpots !== service.maxSpots;
    Object.assign(service, dto);
    const saved = await this.serviceRepo.save(service);
    if (maxSpotsChanged) {
      // Si cambia el máximo general, se borran todos los overrides por sesión
      await this.sessionOverridesService.deleteAllByServiceId(id);
    }
    return saved;
  }

  async remove(id: string, userId: string): Promise<void> {
    const service = await this.findOneForUser(id, userId);
    if (service.isActive) {
      throw new BadRequestException('Desactiva el servicio antes de eliminarlo');
    }
    await this.serviceRepo.delete(id);
  }
}
