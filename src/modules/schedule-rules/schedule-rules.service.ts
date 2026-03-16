import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleRule } from './entities/schedule-rule.entity';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { ServicesService } from '../services/services.service';

@Injectable()
export class ScheduleRulesService {
  constructor(
    @InjectRepository(ScheduleRule)
    private readonly ruleRepo: Repository<ScheduleRule>,
    private readonly servicesService: ServicesService,
  ) {}

  async create(serviceId: string, dto: CreateScheduleRuleDto): Promise<ScheduleRule> {
    // Verificar que el servicio exista
    await this.servicesService.findOne(serviceId);

    // Validar que startTime < endTime
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    const rule = this.ruleRepo.create({
      serviceId,
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.ruleRepo.save(rule);
  }

  async findAllByService(serviceId: string): Promise<ScheduleRule[]> {
    await this.servicesService.findOne(serviceId);
    return this.ruleRepo.find({
      where: { serviceId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async findOne(ruleId: number): Promise<ScheduleRule> {
    const rule = await this.ruleRepo.findOne({ where: { id: ruleId } });
    if (!rule) {
      throw new NotFoundException(`Regla con id ${ruleId} no encontrada`);
    }
    return rule;
  }

  async update(ruleId: number, dto: UpdateScheduleRuleDto): Promise<ScheduleRule> {
    const rule = await this.findOne(ruleId);

    const newStartTime = dto.startTime ?? rule.startTime;
    const newEndTime = dto.endTime ?? rule.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException('startTime debe ser anterior a endTime');
    }

    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async remove(ruleId: number): Promise<void> {
    const rule = await this.findOne(ruleId);
    // Desactivar en lugar de borrar para no perder historial
    rule.isActive = false;
    await this.ruleRepo.save(rule);
  }

  /** Uso interno: obtener reglas activas para un día de semana */
  async findActiveByServiceAndDay(serviceId: string, dayOfWeek: number): Promise<ScheduleRule[]> {
    return this.ruleRepo.find({
      where: { serviceId, dayOfWeek, isActive: true },
      order: { startTime: 'ASC' },
    });
  }
}
