import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQuery } from './dto/list-reservations.dto';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Reservar un cupo',
    description: 'Crea una reserva confirmada. Usa advisory lock para evitar sobre-reservas concurrentes. Retorna 409 si no hay cupos.',
  })
  @ApiBody({ type: CreateReservationDto })
  @ApiResponse({ status: 201, type: Reservation })
  @ApiResponse({ status: 400, description: 'Datos inválidos o slot inexistente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'Sin cupos disponibles' })
  create(@Body() dto: CreateReservationDto): Promise<Reservation> {
    return this.reservationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reservas de un servicio' })
  @ApiQuery({ name: 'service_id', type: Number })
  @ApiQuery({ name: 'date', type: String, required: false, example: '2026-03-20' })
  @ApiQuery({ name: 'status', enum: ReservationStatus, required: false })
  @ApiResponse({ status: 200, type: [Reservation] })
  findAll(@Query() query: ListReservationsQuery): Promise<Reservation[]> {
    return this.reservationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una reserva' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: Reservation })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Reservation> {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar una reserva (libera el cupo)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: Reservation })
  @ApiResponse({ status: 400, description: 'La reserva ya está cancelada' })
  @ApiResponse({ status: 404, description: 'Reserva no encontrada' })
  cancel(@Param('id', ParseIntPipe) id: number): Promise<Reservation> {
    return this.reservationsService.cancel(id);
  }
}
