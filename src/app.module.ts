import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ServicesModule } from './modules/services/services.module';
import { ScheduleRulesModule } from './modules/schedule-rules/schedule-rules.module';
import { ScheduleBlocksModule } from './modules/schedule-blocks/schedule-blocks.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { MembersModule } from './modules/members/members.module';
import { PublicModule } from './modules/public/public.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ApiKeysModule,
    ServicesModule,
    ScheduleRulesModule,
    ScheduleBlocksModule,
    ExceptionsModule,
    AvailabilityModule,
    ReservationsModule,
    MembersModule,
    PublicModule,
  ],
})
export class AppModule {}
