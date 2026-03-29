import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { AvailabilityService } from '../availability/availability.service';

@ApiTags('public')
@Public()
@Throttle({ default: { ttl: 60_000, limit: 20 } })
@Controller('public')
export class PublicController {
  constructor(
    private readonly usersService: UsersService,
    private readonly servicesService: ServicesService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  @Get('centers')
  @ApiOperation({ summary: 'Buscar centros por nombre o código' })
  @ApiQuery({ name: 'q', type: String, required: false })
  async searchCenters(@Query('q') q: string = '') {
    if (q && q.length < 2) {
      throw new BadRequestException('El parámetro de búsqueda debe tener al menos 2 caracteres');
    }
    return this.usersService.searchCenters(q);
  }

  @Get('centers/:code/services')
  @ApiOperation({ summary: 'Obtener servicios activos de un centro por código' })
  async getCenterServices(@Param('code') code: string) {
    const admin = await this.usersService.findByCenterCode(code);
    if (!admin) return [];
    const services = await this.servicesService.findAll(admin.id);
    return services.filter((s) => s.isActive);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de slots (público)' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'date', type: String })
  async getAvailability(
    @Query('service_id', ParseUUIDPipe) serviceId: string,
    @Query('date') date: string,
  ) {
    return this.availabilityService.getAvailabilityByDate(serviceId, date);
  }

  @Get('availability/range')
  @ApiOperation({ summary: 'Consultar disponibilidad por rango de fechas (público, batch)' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'start_date', type: String, example: '2026-03-29' })
  @ApiQuery({ name: 'end_date', type: String, example: '2026-04-11' })
  async getAvailabilityRange(
    @Query('service_id', ParseUUIDPipe) serviceId: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.availabilityService.getAvailabilityByDateRange(serviceId, startDate, endDate);
  }

  @Get('availability/spots')
  @ApiOperation({ summary: 'Consultar cupos numerados de una sesión (público)' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'slot_start', type: String, example: '2026-03-20T14:00:00.000Z' })
  async getSpots(
    @Query('service_id', ParseUUIDPipe) serviceId: string,
    @Query('slot_start') slotStart: string,
  ) {
    return this.availabilityService.getSpotsForSlot(serviceId, slotStart);
  }
}
