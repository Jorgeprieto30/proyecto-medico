import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleRule } from './entities/schedule-rule.entity';
import { ScheduleRulesService } from './schedule-rules.service';
import { ScheduleRulesController } from './schedule-rules.controller';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleRule]), ServicesModule],
  controllers: [ScheduleRulesController],
  providers: [ScheduleRulesService],
  exports: [ScheduleRulesService],
})
export class ScheduleRulesModule {}
