import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { UsersService } from './users.service';
import { OwnerGuard } from '../auth/guards/owner.guard';

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

export class UpdateSubscriptionDto {
  @IsIn(['trial', 'starter', 'active', 'past_due', 'cancelled'])
  subscription_status: 'trial' | 'starter' | 'active' | 'past_due' | 'cancelled';
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Listar todos los usuarios de la plataforma (solo owner)' })
  findAll() {
    return this.usersService.findAll();
  }

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

  @Patch('me/plan')
  @ApiOperation({ summary: 'Actualizar estado de suscripción del usuario autenticado' })
  updatePlan(@Request() req: any, @Body() dto: UpdateSubscriptionDto) {
    return this.usersService.updateSubscriptionStatus(req.user.id, dto.subscription_status);
  }
}
