import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { ExceptionsService } from './exceptions.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { UpdateExceptionDto } from './dto/update-exception.dto';
import { ServiceException } from './entities/service-exception.entity';

@ApiTags('exceptions')
@Controller()
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post('services/:serviceId/exceptions')
  @ApiOperation({ summary: 'Crear una excepción por fecha para un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiBody({ type: CreateExceptionDto })
  @ApiResponse({ status: 201, type: ServiceException })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  create(
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateExceptionDto,
  ): Promise<ServiceException> {
    return this.exceptionsService.create(serviceId, dto);
  }

  @Get('services/:serviceId/exceptions')
  @ApiOperation({ summary: 'Listar excepciones de un servicio' })
  @ApiParam({ name: 'serviceId', type: String })
  @ApiResponse({ status: 200, type: [ServiceException] })
  findAll(
    @Param('serviceId') serviceId: string,
  ): Promise<ServiceException[]> {
    return this.exceptionsService.findAllByService(serviceId);
  }

  @Patch('exceptions/:exceptionId')
  @ApiOperation({ summary: 'Actualizar una excepción' })
  @ApiParam({ name: 'exceptionId', type: Number })
  @ApiBody({ type: UpdateExceptionDto })
  @ApiResponse({ status: 200, type: ServiceException })
  @ApiResponse({ status: 404, description: 'Excepción no encontrada' })
  update(
    @Param('exceptionId', ParseIntPipe) exceptionId: number,
    @Body() dto: UpdateExceptionDto,
  ): Promise<ServiceException> {
    return this.exceptionsService.update(exceptionId, dto);
  }

  @Delete('exceptions/:exceptionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una excepción' })
  @ApiParam({ name: 'exceptionId', type: Number })
  @ApiResponse({ status: 204, description: 'Excepción eliminada' })
  @ApiResponse({ status: 404, description: 'Excepción no encontrada' })
  remove(@Param('exceptionId', ParseIntPipe) exceptionId: number): Promise<void> {
    return this.exceptionsService.remove(exceptionId);
  }
}
