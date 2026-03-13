import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ScheduleBlocksService } from './schedule-blocks.service';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';
import { ScheduleBlock } from './entities/schedule-block.entity';

@ApiTags('schedule-blocks')
@Controller()
export class ScheduleBlocksController {
  constructor(private readonly blocksService: ScheduleBlocksService) {}

  @Post('services/:serviceId/schedule-blocks')
  @ApiOperation({ summary: 'Crear un tramo horario con capacidad para un servicio' })
  @ApiParam({ name: 'serviceId', type: Number })
  @ApiBody({ type: CreateScheduleBlockDto })
  @ApiResponse({ status: 201, type: ScheduleBlock })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  create(
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: CreateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    return this.blocksService.create(serviceId, dto);
  }

  @Get('services/:serviceId/schedule-blocks')
  @ApiOperation({ summary: 'Listar tramos horarios con capacidad de un servicio' })
  @ApiParam({ name: 'serviceId', type: Number })
  @ApiResponse({ status: 200, type: [ScheduleBlock] })
  findAll(
    @Param('serviceId', ParseIntPipe) serviceId: number,
  ): Promise<ScheduleBlock[]> {
    return this.blocksService.findAllByService(serviceId);
  }

  @Patch('schedule-blocks/:blockId')
  @ApiOperation({ summary: 'Actualizar un tramo horario' })
  @ApiParam({ name: 'blockId', type: Number })
  @ApiBody({ type: UpdateScheduleBlockDto })
  @ApiResponse({ status: 200, type: ScheduleBlock })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  update(
    @Param('blockId', ParseIntPipe) blockId: number,
    @Body() dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    return this.blocksService.update(blockId, dto);
  }

  @Delete('schedule-blocks/:blockId')
  @ApiOperation({ summary: 'Desactivar un tramo horario' })
  @ApiParam({ name: 'blockId', type: Number })
  @ApiResponse({ status: 200, description: 'Tramo desactivado' })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  remove(@Param('blockId', ParseIntPipe) blockId: number): Promise<void> {
    return this.blocksService.remove(blockId);
  }
}
