import { Body, Controller, Get, Patch, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { UsersService } from './users.service';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  center_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  center_code?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  getMe(@Request() req: any) {
    return req.user;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil del centro del usuario autenticado' })
  updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}
