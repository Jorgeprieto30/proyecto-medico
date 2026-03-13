import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './modules/services/services.module';
import { ScheduleRulesModule } from './modules/schedule-rules/schedule-rules.module';
import { ScheduleBlocksModule } from './modules/schedule-blocks/schedule-blocks.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { ReservationsModule } from './modules/reservations/reservations.module';

@Module({
  imports: [
    DatabaseModule,
    ServicesModule,
    ScheduleRulesModule,
    ScheduleBlocksModule,
    ExceptionsModule,
    AvailabilityModule,
    ReservationsModule,
  ],
})
export class AppModule {}
