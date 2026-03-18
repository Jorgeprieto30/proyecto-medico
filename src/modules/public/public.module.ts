import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [UsersModule, ServicesModule, AvailabilityModule],
  controllers: [PublicController],
})
export class PublicModule {}
