import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateScheduleBlockDto {
  @ApiProperty({
    example: 1,
    description: 'Día de semana ISO: 1=Lunes, 2=Martes, ..., 7=Domingo',
    minimum: 1,
    maximum: 7,
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00', description: 'Inicio del tramo (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:MM (ej: 08:00)' })
  startTime: string;

  @ApiProperty({ example: '09:00', description: 'Fin del tramo (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:MM (ej: 09:00)' })
  endTime: string;

  @ApiProperty({
    example: 5,
    description: 'Número de cupos para este tramo horario',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
