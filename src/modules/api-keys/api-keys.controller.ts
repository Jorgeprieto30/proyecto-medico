import {
  Controller, Get, Post, Delete, Body, Param, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva API key' })
  create(@Body() dto: CreateApiKeyDto, @Request() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis API keys' })
  list(@Request() req: any) {
    return this.service.findAllByUser(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revocar una API key' })
  revoke(@Param('id') id: string, @Request() req: any) {
    return this.service.revoke(id, req.user.id);
  }
}
