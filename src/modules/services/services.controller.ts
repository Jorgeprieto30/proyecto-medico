import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service } from './entities/service.entity';
import { SessionSpotOverridesService } from '../session-spot-overrides/session-spot-overrides.service';
import { UpsertSessionOverrideDto } from '../session-spot-overrides/dto/upsert-override.dto';
import { DateTime } from 'luxon';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly sessionOverridesService: SessionSpotOverridesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo servicio' })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({ status: 201, type: Service })
  create(@Body() dto: CreateServiceDto, @Req() req: any): Promise<Service> {
    return this.servicesService.create(dto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Listar servicios del admin autenticado' })
  @ApiResponse({ status: 200, type: [Service] })
  findAll(@Req() req: any): Promise<Service[]> {
    return this.servicesService.findAll(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un servicio' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: Service })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('id') id: string, @Req() req: any): Promise<Service> {
    return this.servicesService.findOneForUser(id, req.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un servicio (si cambia max_spots, borra overrides por sesión)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({ status: 200, type: Service })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @Req() req: any,
  ): Promise<Service> {
    return this.servicesService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un servicio (debe estar inactivo)' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Servicio eliminado' })
  remove(@Param('id') id: string, @Req() req: any): Promise<void> {
    return this.servicesService.remove(id, req.user.sub);
  }

  // ─── Session spot overrides ───────────────────────────────────────────────

  @Post(':id/session-overrides')
  @ApiOperation({
    summary: 'Crear/actualizar override de cupos para una sesión específica',
    description:
      'Permite cambiar el máximo de cupos para una sesión puntual sin afectar las demás.',
  })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  @ApiBody({ type: UpsertSessionOverrideDto })
  async upsertSessionOverride(
    @Param('id') serviceId: string,
    @Body() dto: UpsertSessionOverrideDto,
    @Req() req: any,
  ) {
    await this.servicesService.findOneForUser(serviceId, req.user.sub);
    const slotStartDt = DateTime.fromISO(dto.slot_start, { setZone: true });
    const slotStartUtc = slotStartDt.toUTC().toJSDate();
    return this.sessionOverridesService.upsert(serviceId, slotStartUtc, dto.max_spots);
  }

  @Delete(':id/session-overrides')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar override de una sesión específica (vuelve al default del servicio)' })
  @ApiParam({ name: 'id', description: 'ID del servicio' })
  async deleteSessionOverride(
    @Param('id') serviceId: string,
    @Body() dto: Pick<UpsertSessionOverrideDto, 'slot_start'>,
    @Req() req: any,
  ) {
    await this.servicesService.findOneForUser(serviceId, req.user.sub);
    const slotStartUtc = DateTime.fromISO(dto.slot_start, { setZone: true }).toUTC().toJSDate();
    await this.sessionOverridesService.deleteByServiceAndSlot(serviceId, slotStartUtc);
  }
}
