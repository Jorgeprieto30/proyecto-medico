import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceException } from './entities/service-exception.entity';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { ServicesService } from '../services/services.service';

@Injectable()
export class ExceptionsService {
  constructor(
    @InjectRepository(ServiceException)
    private readonly exceptionRepo: Repository<ServiceException>,
    private readonly servicesService: ServicesService,
  ) {}

  async create(serviceId: string, userId: string, dto: CreateExceptionDto): Promise<ServiceException> {
    await this.servicesService.findOneForUser(serviceId, userId);

    const exception = this.exceptionRepo.create({
      serviceId,
      exceptionDate: dto.exceptionDate,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      isClosed: dto.isClosed,
      capacityOverride: dto.capacityOverride ?? null,
      reason: dto.reason ?? null,
    });
    return this.exceptionRepo.save(exception);
  }

  async findAllByService(serviceId: string, userId: string): Promise<ServiceException[]> {
    await this.servicesService.findOneForUser(serviceId, userId);
    return this.exceptionRepo.find({
      where: { serviceId },
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(exceptionId: number): Promise<ServiceException> {
    const ex = await this.exceptionRepo.findOne({ where: { id: exceptionId } });
    if (!ex) {
      throw new NotFoundException(`Excepción con id ${exceptionId} no encontrada`);
    }
    return ex;
  }

  async update(exceptionId: number, userId: string, dto: UpdateExceptionDto): Promise<ServiceException> {
    const ex = await this.findOne(exceptionId);
    await this.servicesService.findOneForUser(ex.serviceId, userId);
    Object.assign(ex, {
      ...dto,
      startTime: dto.startTime !== undefined ? (dto.startTime ?? null) : ex.startTime,
      endTime: dto.endTime !== undefined ? (dto.endTime ?? null) : ex.endTime,
      capacityOverride:
        dto.capacityOverride !== undefined ? (dto.capacityOverride ?? null) : ex.capacityOverride,
      reason: dto.reason !== undefined ? (dto.reason ?? null) : ex.reason,
    });
    return this.exceptionRepo.save(ex);
  }

  async remove(exceptionId: number, userId: string): Promise<void> {
    const ex = await this.findOne(exceptionId);
    await this.servicesService.findOneForUser(ex.serviceId, userId);
    await this.exceptionRepo.remove(ex);
  }

  /** Uso interno: obtener excepciones de un servicio para una fecha específica */
  async findByServiceAndDate(serviceId: string, date: string): Promise<ServiceException[]> {
    return this.exceptionRepo.find({
      where: { serviceId, exceptionDate: date },
      order: { startTime: 'ASC' },
    });
  }
}
