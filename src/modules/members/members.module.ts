import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Member } from './entities/member.entity';
import { MemberCenterVisit } from './entities/member-center-visit.entity';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { MemberJwtStrategy } from './strategies/member-jwt.strategy';
import { ReservationsModule } from '../reservations/reservations.module';
import { MailModule } from '../mail/mail.module';
import { ServicesModule } from '../services/services.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member, MemberCenterVisit]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET env var is required');
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
    ReservationsModule,
    MailModule,
    ServicesModule,
    UsersModule,
  ],
  controllers: [MembersController],
  providers: [MembersService, MemberJwtStrategy],
  exports: [MembersService],
})
export class MembersModule {}
