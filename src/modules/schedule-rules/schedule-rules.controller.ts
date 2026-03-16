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
import { ScheduleRulesService } from './schedule-rules.service';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto';
import { ScheduleRule } from './entities/schedule-rule.entity';

@ApiTags('schedule-rules')
@Controller()
export class ScheduleRulesController {
  constructor(private readonly rulesService: ScheduleRulesService) {}

  @Post('services/:serviceId/schedule-rules')
  @ApiOperation({ summary: 'Crear una regla semanal para un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiBody({ type: CreateScheduleRuleDto })
  @ApiResponse({ status: 201, type: ScheduleRule })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  create(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateScheduleRuleDto,
  ): Promise<ScheduleRule> {
    return this.rulesService.create(serviceId, dto);
  }

  @Get('services/:serviceId/schedule-rules')
  @ApiOperation({ summary: 'Listar reglas semanales de un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiResponse({ status: 200, type: [ScheduleRule] })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findAll(
    @Param('serviceId') serviceId: string,
  ): Promise<ScheduleRule[]> {
    return this.rulesService.findAllByService(serviceId);
  }

  @Patch('schedule-rules/:ruleId')
  @ApiOperation({ summary: 'Actualizar una regla semanal' })
  @ApiParam({ name: 'ruleId', type: Number })
  @ApiBody({ type: UpdateScheduleRuleDto })
  @ApiResponse({ status: 200, type: ScheduleRule })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  update(
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body() dto: UpdateScheduleRuleDto,
  ): Promise<ScheduleRule> {
    return this.rulesService.update(ruleId, dto);
  }

  @Delete('schedule-rules/:ruleId')
  @ApiOperation({ summary: 'Desactivar una regla semanal' })
  @ApiParam({ name: 'ruleId', type: Number })
  @ApiResponse({ status: 200, description: 'Regla desactivada' })
  @ApiResponse({ status: 404, description: 'Regla no encontrada' })
  remove(@Param('ruleId', ParseIntPipe) ruleId: number): Promise<void> {
    return this.rulesService.remove(ruleId);
  }
}
