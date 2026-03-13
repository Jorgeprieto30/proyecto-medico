import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/entities/reservation.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { ServicesModule } from '../services/services.module';
import { ScheduleRulesModule } from '../schedule-rules/schedule-rules.module';
import { ScheduleBlocksModule } from '../schedule-blocks/schedule-blocks.module';
import { ExceptionsModule } from '../exceptions/exceptions.module';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    ServicesModule,
    ScheduleRulesModule,
    ScheduleBlocksModule,
    ExceptionsModule,
    forwardRef(() => ReservationsModule),
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
