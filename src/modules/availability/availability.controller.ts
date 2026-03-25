import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AvailabilityService } from './availability.service';
import { SlotAvailabilityDto, SlotDetailDto, SlotSpotsDto } from './dto/availability.dto';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar disponibilidad por fecha' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'date', type: String, example: '2026-03-20' })
  @ApiResponse({ status: 200, type: [SlotAvailabilityDto] })
  getByDate(
    @Query('service_id') serviceId: string,
    @Query('date') date: string,
  ): Promise<SlotAvailabilityDto[]> {
    return this.availabilityService.getAvailabilityByDate(serviceId, date);
  }

  @Get('slot')
  @ApiOperation({ summary: 'Consultar disponibilidad de un bloque puntual' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'datetime', type: String, example: '2026-03-20T09:00:00-03:00' })
  @ApiResponse({ status: 200, type: SlotDetailDto })
  getBySlot(
    @Query('service_id') serviceId: string,
    @Query('datetime') datetime: string,
  ): Promise<SlotDetailDto> {
    return this.availabilityService.getAvailabilityBySlot(serviceId, datetime);
  }

  @Get('spots')
  @ApiOperation({
    summary: 'Consultar cupos numerados de una sesión',
    description:
      'Retorna el listado de cupos (1..max_spots) con su estado disponible/tomado para un slot específico.',
  })
  @ApiQuery({ name: 'service_id', type: String, description: 'ID del servicio (UUID)' })
  @ApiQuery({
    name: 'slot_start',
    type: String,
    description: 'ISO 8601 UTC del inicio del slot',
    example: '2026-03-20T14:00:00.000Z',
  })
  @ApiResponse({ status: 200, type: SlotSpotsDto })
  @ApiResponse({ status: 404, description: 'Slot no encontrado' })
  getSpots(
    @Query('service_id') serviceId: string,
    @Query('slot_start') slotStart: string,
  ): Promise<SlotSpotsDto> {
    return this.availabilityService.getSpotsForSlot(serviceId, slotStart);
  }
}
