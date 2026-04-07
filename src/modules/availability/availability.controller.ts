import { BadRequestException, Controller, Get, Query, ParseBoolPipe, DefaultValuePipe, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { DateTime } from 'luxon';
import { AvailabilityService } from './availability.service';
import { SlotAvailabilityDto, SlotDetailDto, SlotSpotsDto } from './dto/availability.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 60;

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar disponibilidad por fecha' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'date', type: String, example: '2026-03-20' })
  @ApiQuery({ name: 'include_past', type: Boolean, required: false, description: 'Incluir slots pasados (solo para admin autenticado)' })
  @ApiResponse({ status: 200, type: [SlotAvailabilityDto] })
  getByDate(
    @Query('service_id') serviceId: string,
    @Query('date') date: string,
    @Query('include_past', new DefaultValuePipe(false), ParseBoolPipe) includePast: boolean,
    @Req() req: any,
  ): Promise<SlotAvailabilityDto[]> {
    // include_past solo se honra para usuarios autenticados (admins)
    const effectiveIncludePast = includePast && !!req.user;
    return this.availabilityService.getAvailabilityByDate(serviceId, date, effectiveIncludePast);
  }

  @Get('range')
  @ApiOperation({ summary: 'Consultar disponibilidad por rango de fechas (batch, máx. 60 días)' })
  @ApiQuery({ name: 'service_id', type: String })
  @ApiQuery({ name: 'start_date', type: String, example: '2026-03-23' })
  @ApiQuery({ name: 'end_date', type: String, example: '2026-03-29' })
  @ApiQuery({ name: 'include_past', type: Boolean, required: false })
  getByDateRange(
    @Query('service_id') serviceId: string,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Query('include_past', new DefaultValuePipe(false), ParseBoolPipe) includePast: boolean,
    @Req() req: any,
  ): Promise<Record<string, any[]>> {
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      throw new BadRequestException('start_date y end_date deben tener formato YYYY-MM-DD');
    }
    if (startDate > endDate) {
      throw new BadRequestException('start_date debe ser menor o igual a end_date');
    }
    const diffDays = DateTime.fromISO(endDate).diff(DateTime.fromISO(startDate), 'days').days;
    if (diffDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`El rango máximo permitido es de ${MAX_RANGE_DAYS} días`);
    }
    // include_past solo se honra para usuarios autenticados (admins)
    const effectiveIncludePast = includePast && !!req.user;
    return this.availabilityService.getAvailabilityByDateRange(serviceId, startDate, endDate, effectiveIncludePast);
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
