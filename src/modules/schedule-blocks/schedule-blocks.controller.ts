import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
@ApiBearerAuth()
@Controller()
export class ScheduleBlocksController {
  constructor(private readonly blocksService: ScheduleBlocksService) {}

  @Post('services/:serviceId/schedule-blocks')
  @ApiOperation({ summary: 'Crear un tramo horario con capacidad para un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiBody({ type: CreateScheduleBlockDto })
  @ApiResponse({ status: 201, type: ScheduleBlock })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  create(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateScheduleBlockDto,
    @Req() req: any,
  ): Promise<ScheduleBlock> {
    return this.blocksService.create(serviceId, req.user.sub, dto);
  }

  @Get('services/:serviceId/schedule-blocks')
  @ApiOperation({ summary: 'Listar tramos horarios con capacidad de un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiResponse({ status: 200, type: [ScheduleBlock] })
  findAll(
    @Param('serviceId') serviceId: string,
    @Req() req: any,
  ): Promise<ScheduleBlock[]> {
    return this.blocksService.findAllByService(serviceId, req.user.sub);
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
    @Req() req: any,
  ): Promise<ScheduleBlock> {
    return this.blocksService.update(blockId, req.user.sub, dto);
  }

  @Delete('schedule-blocks/:blockId')
  @ApiOperation({ summary: 'Desactivar un tramo horario' })
  @ApiParam({ name: 'blockId', type: Number })
  @ApiResponse({ status: 200, description: 'Tramo desactivado' })
  @ApiResponse({ status: 404, description: 'Bloque no encontrado' })
  remove(
    @Param('blockId', ParseIntPipe) blockId: number,
    @Req() req: any,
  ): Promise<void> {
    return this.blocksService.remove(blockId, req.user.sub);
  }
}
