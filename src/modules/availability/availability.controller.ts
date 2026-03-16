import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { SlotAvailabilityDto, SlotDetailDto } from './dto/availability.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar disponibilidad por fecha',
    description: `Retorna todos los bloques válidos del día con su ocupación actual.

Ejemplo: GET /availability?service_id=1&date=2026-03-20`,
  })
  @ApiQuery({ name: 'service_id', type: String, description: 'ID del servicio (UUID)' })
  @ApiQuery({
    name: 'date',
    type: String,
    description: 'Fecha a consultar (YYYY-MM-DD)',
    example: '2026-03-20',
  })
  @ApiResponse({
    status: 200,
    type: [SlotAvailabilityDto],
    description: 'Lista de bloques del día con disponibilidad',
  })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  getByDate(
    @Query('service_id') serviceId: string,
    @Query('date') date: string,
  ): Promise<SlotAvailabilityDto[]> {
    return this.availabilityService.getAvailabilityByDate(serviceId, date);
  }

  @Get('slot')
  @ApiOperation({
    summary: 'Consultar disponibilidad de un bloque puntual',
    description: `Retorna la disponibilidad de un slot específico.

Ejemplo: GET /availability/slot?service_id=1&datetime=2026-03-20T09:00:00-03:00`,
  })
  @ApiQuery({ name: 'service_id', type: String, description: 'ID del servicio (UUID)' })
  @ApiQuery({
    name: 'datetime',
    type: String,
    description: 'Fecha y hora ISO 8601 del inicio del bloque',
    example: '2026-03-20T09:00:00-03:00',
  })
  @ApiResponse({
    status: 200,
    type: SlotDetailDto,
    description: 'Detalle del bloque con disponibilidad',
  })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  getBySlot(
    @Query('service_id') serviceId: string,
    @Query('datetime') datetime: string,
  ): Promise<SlotDetailDto> {
    return this.availabilityService.getAvailabilityBySlot(serviceId, datetime);
  }
}
