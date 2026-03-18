import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { UpdateMemberDto, ChangePasswordDto } from './dto/update-member.dto';
import { MemberJwtGuard } from './guards/member-jwt.guard';
import { Member } from './decorators/member.decorator';
import { Member as MemberEntity } from './entities/member.entity';
import { Public } from '../auth/decorators/public.decorator';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateReservationDto } from '../reservations/dto/create-reservation.dto';
import { MailService } from '../mail/mail.service';
import { ServicesService } from '../services/services.service';

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly reservationsService: ReservationsService,
    private readonly mailService: MailService,
    private readonly servicesService: ServicesService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo miembro' })
  register(@Body() dto: RegisterMemberDto) {
    return this.membersService.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión como miembro' })
  login(@Body() dto: LoginMemberDto) {
    return this.membersService.login(dto);
  }

  @UseGuards(MemberJwtGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del miembro autenticado' })
  getMe(@Member() member: MemberEntity) {
    return member;
  }

  @UseGuards(MemberJwtGuard)
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del miembro' })
  updateMe(@Member() member: MemberEntity, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateProfile(member.id, dto);
  }

  @UseGuards(MemberJwtGuard)
  @Patch('me/password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña del miembro' })
  changePassword(@Member() member: MemberEntity, @Body() dto: ChangePasswordDto) {
    return this.membersService.changePassword(member.id, dto);
  }

  @UseGuards(MemberJwtGuard)
  @Post('reservations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una reserva como miembro' })
  async createReservation(
    @Member() member: MemberEntity,
    @Body() dto: CreateReservationDto,
  ) {
    const enrichedDto: CreateReservationDto = {
      ...dto,
      customer_name: dto.customer_name ?? `${member.first_name} ${member.last_name}`,
      customer_external_id: dto.customer_external_id ?? member.rut ?? undefined,
      metadata: {
        ...(dto.metadata ?? {}),
        member_id: member.id,
      },
    };
    const reservation = await this.reservationsService.create(enrichedDto);

    // Send confirmation email (fire-and-forget)
    try {
      const service = await this.servicesService.findOne(dto.service_id);
      this.mailService.sendReservationConfirmation({
        to: member.email,
        customerName: `${member.first_name} ${member.last_name}`,
        serviceName: service.name,
        slotStart: reservation.slotStart,
        slotEnd: reservation.slotEnd,
        timezone: service.timezone,
        reservationId: reservation.id,
      });
    } catch { /* non-critical */ }

    return reservation;
  }

  @UseGuards(MemberJwtGuard)
  @Get('reservations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar reservas del miembro autenticado' })
  getReservations(@Member() member: MemberEntity) {
    return this.reservationsService.findByMemberId(member.id);
  }
}
