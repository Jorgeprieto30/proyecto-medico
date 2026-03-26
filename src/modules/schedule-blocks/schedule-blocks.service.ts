import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleBlock } from './entities/schedule-block.entity';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';
import { ServicesService } from '../services/services.service';

@Injectable()
export class ScheduleBlocksService {
  constructor(
    @InjectRepository(ScheduleBlock)
    private readonly blockRepo: Repository<ScheduleBlock>,
    private readonly servicesService: ServicesService,
  ) {}

  async create(serviceId: string, userId: string, dto: CreateScheduleBlockDto): Promise<ScheduleBlock> {
    await this.servicesService.findOneForUser(serviceId, userId);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    const block = this.blockRepo.create({
      serviceId,
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.blockRepo.save(block);
  }

  async findAllByService(serviceId: string, userId: string): Promise<ScheduleBlock[]> {
    await this.servicesService.findOneForUser(serviceId, userId);
    return this.blockRepo.find({
      where: { serviceId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(blockId: number): Promise<ScheduleBlock> {
    const block = await this.blockRepo.findOne({ where: { id: blockId } });
    if (!block) {
      throw new NotFoundException(`Bloque con id ${blockId} no encontrado`);
    }
    return block;
  }

  async update(blockId: number, userId: string, dto: UpdateScheduleBlockDto): Promise<ScheduleBlock> {
    const block = await this.findOne(blockId);
    await this.servicesService.findOneForUser(block.serviceId, userId);

    const newStartTime = dto.startTime ?? block.startTime;
    const newEndTime = dto.endTime ?? block.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    Object.assign(block, dto);
    return this.blockRepo.save(block);
  }

  async remove(blockId: number, userId: string): Promise<void> {
    const block = await this.findOne(blockId);
    await this.servicesService.findOneForUser(block.serviceId, userId);
    block.isActive = false;
    await this.blockRepo.save(block);
  }

  /** Uso interno: obtener bloques activos de un servicio para un día de semana */
  async findActiveByServiceAndDay(
    serviceId: string,
    dayOfWeek: number,
  ): Promise<ScheduleBlock[]> {
    return this.blockRepo.find({
      where: { serviceId, dayOfWeek, isActive: true },
      order: { startTime: 'ASC' },
    });
  }
}
