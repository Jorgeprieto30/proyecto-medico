import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  Req,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString } from 'class-validator';
import { MembersService } from './members.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { LoginMemberDto } from './dto/login-member.dto';
import { UpdateMemberDto, ChangePasswordDto } from './dto/update-member.dto';
import { AdminCreateMemberDto } from './dto/admin-create-member.dto';
import { ForgotPasswordMemberDto } from './dto/forgot-password-member.dto';
import { ResetPasswordMemberDto } from './dto/reset-password-member.dto';
import { Member } from './decorators/member.decorator';
import { MemberAuth } from './decorators/member-auth.decorator';
import { Member as MemberEntity } from './entities/member.entity';
import { Public } from '../auth/decorators/public.decorator';
import { ReservationsService } from '../reservations/reservations.service';
import { CreateReservationDto } from '../reservations/dto/create-reservation.dto';
import { MailService } from '../mail/mail.service';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';

class RecordVisitDto {
  @IsString()
  center_code: string;
}

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly reservationsService: ReservationsService,
    private readonly mailService: MailService,
    private readonly servicesService: ServicesService,
    private readonly usersService: UsersService,
  ) {}

  // ─── Admin: ver visitantes de su centro ────────────────────────────────────

  @Get('my-visitors')
  @ApiOperation({ summary: '[Admin] Listar miembros que visitaron este centro' })
  getMyVisitors(@Request() req: any) {
    return this.membersService.findMyVisitors(req.user.id);
  }

  // ─── Member: registrar visita a un centro ──────────────────────────────────

  @MemberAuth()
  @Post('visit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registrar visita de un miembro a un centro' })
  async recordVisit(@Member() member: MemberEntity, @Body() dto: RecordVisitDto) {
    const center = await this.usersService.findByCenterCode(dto.center_code);
    if (!center) return { ok: false };
    await this.membersService.recordVisit(member.id, center.id);
    return { ok: true };
  }

  // ─── Admin: buscar miembros ─────────────────────────────────────────────────

  @Get('search')
  @ApiOperation({ summary: '[Admin] Buscar miembros por nombre, RUT o email' })
  searchMembers(@Query('q') q: string) {
    return this.membersService.searchMembers(q ?? '');
  }

  @Post('admin-create')
  @ApiOperation({ summary: '[Admin] Registrar un cliente sin contraseña' })
  adminCreate(@Body() dto: AdminCreateMemberDto) {
    return this.membersService.adminCreate(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo miembro' })
  register(@Body() dto: RegisterMemberDto) {
    return this.membersService.register(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión como miembro' })
  login(@Body() dto: LoginMemberDto, @Req() req: any) {
    const ip = req.ip ?? req.headers['x-forwarded-for'] ?? 'unknown';
    return this.membersService.login(dto, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordMemberDto) {
    await this.membersService.forgotPassword(dto.email);
    return { message: 'Si el email está registrado, recibirás un enlace de recuperación en los próximos minutos.' };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  async resetPassword(@Body() dto: ResetPasswordMemberDto) {
    await this.membersService.resetPassword(dto.token, dto.password);
    return { message: 'Contraseña actualizada correctamente.' };
  }

  @MemberAuth()
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del miembro autenticado' })
  getMe(@Member() member: MemberEntity) {
    return member;
  }

  @MemberAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil del miembro' })
  updateMe(@Member() member: MemberEntity, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateProfile(member.id, dto);
  }

  @MemberAuth()
  @Patch('me/password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambiar contraseña del miembro' })
  async changePassword(@Member() member: MemberEntity, @Body() dto: ChangePasswordDto) {
    await this.membersService.changePassword(member.id, dto);
    return { message: 'Contraseña actualizada correctamente.' };
  }

  @MemberAuth()
  @Post('reservations')
  @ApiOperation({ summary: 'Crear una reserva como miembro' })
  async createReservation(
    @Member() member: MemberEntity,
    @Body() dto: CreateReservationDto,
  ) {
    const slotStartDate = new Date(dto.slot_start);
    const existing = await this.reservationsService.findActiveMemberReservation(
      member.id,
      dto.service_id,
      slotStartDate,
    );
    if (existing) {
      throw new ConflictException('DUPLICATE_BOOKING');
    }

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

    // Send confirmation email (fire-and-forget, errors are non-critical)
    this.servicesService.findOne(dto.service_id)
      .then((service) =>
        this.mailService.sendReservationConfirmation({
          to: member.email,
          customerName: `${member.first_name} ${member.last_name}`,
          serviceName: service.name,
          slotStart: reservation.slotStart,
          slotEnd: reservation.slotEnd,
          timezone: service.timezone,
          reservationId: reservation.id,
        }),
      )
      .catch(() => { /* non-critical */ });

    return reservation;
  }

  @MemberAuth()
  @Get('reservations')
  @ApiOperation({ summary: 'Listar reservas del miembro autenticado' })
  getReservations(@Member() member: MemberEntity) {
    return this.reservationsService.findByMemberId(member.id);
  }

  @MemberAuth()
  @Patch('reservations/:id/cancel')
  @ApiOperation({ summary: 'Cancelar una reserva propia del miembro' })
  cancelReservation(
    @Member() member: MemberEntity,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reservationsService.cancelByMember(id, member.id);
  }
}
