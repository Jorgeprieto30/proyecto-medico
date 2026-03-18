import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Member } from './entities/member.entity';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { MemberJwtStrategy } from './strategies/member-jwt.strategy';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Member]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '30d' },
    }),
    ReservationsModule,
  ],
  controllers: [MembersController],
  providers: [MembersService, MemberJwtStrategy],
  exports: [MembersService],
})
export class MembersModule {}
