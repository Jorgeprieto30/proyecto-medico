import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateScheduleRuleDto {
  @ApiProperty({
    example: 1,
    description: 'Día de semana ISO: 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo',
    minimum: 1,
    maximum: 7,
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: '08:00', description: 'Hora de inicio local (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:MM (ej: 08:00)' })
  startTime: string;

  @ApiProperty({ example: '20:00', description: 'Hora de fin local (HH:MM)' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:MM (ej: 20:00)' })
  endTime: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Fecha de inicio de vigencia (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fecha de fin de vigencia (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
