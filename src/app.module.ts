import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { SessionSpotOverridesModule } from './modules/session-spot-overrides/session-spot-overrides.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    DatabaseModule,
    AuthModule,
    ApiKeysModule,
    SessionSpotOverridesModule,
    ServicesModule,
    ScheduleRulesModule,
    ScheduleBlocksModule,
    ExceptionsModule,
    AvailabilityModule,
    ReservationsModule,
    MembersModule,
    PublicModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
