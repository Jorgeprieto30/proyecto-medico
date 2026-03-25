import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/entities/reservation.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { ServicesModule } from '../services/services.module';
import { ScheduleRulesModule } from '../schedule-rules/schedule-rules.module';
import { ExceptionsModule } from '../exceptions/exceptions.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { SessionSpotOverridesModule } from '../session-spot-overrides/session-spot-overrides.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    ServicesModule,
    ScheduleRulesModule,
    ExceptionsModule,
    SessionSpotOverridesModule,
    forwardRef(() => ReservationsModule),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
