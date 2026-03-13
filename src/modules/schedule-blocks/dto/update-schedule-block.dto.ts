import { PartialType } from '@nestjs/swagger';
import { CreateScheduleBlockDto } from './create-schedule-block.dto';

export class UpdateScheduleBlockDto extends PartialType(CreateScheduleBlockDto) {}
