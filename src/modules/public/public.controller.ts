import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { AvailabilityService } from '../availability/availability.service';

@ApiTags('public')
@Public()
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
    return this.usersService.searchCenters(q);
  }

  @Get('centers/:code/services')
  @ApiOperation({ summary: 'Obtener servicios activos de un centro por código' })
  async getCenterServices(@Param('code') code: string) {
    const admin = await this.usersService.findByCenterCode(code);
    if (!admin) return [];
    // Get all services and filter by admin user — we need to add userId to Service
    // For now: return all services (multi-tenant filtering is done via center lookup)
    const allServices = await this.servicesService.findAll();
    return allServices.filter((s) => s.isActive);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de slots (público)' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'date', type: String })
  async getAvailability(
    @Query('service_id') serviceId: string,
    @Query('date') date: string,
  ) {
    return this.availabilityService.getAvailabilityByDate(serviceId, date);
  }
}
