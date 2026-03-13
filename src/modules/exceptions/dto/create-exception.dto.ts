import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateExceptionDto {
  @ApiProperty({
    example: '2026-03-21',
    description: 'Fecha de la excepción (YYYY-MM-DD)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(DATE_REGEX, { message: 'exceptionDate debe tener formato YYYY-MM-DD' })
  exceptionDate: string;

  @ApiPropertyOptional({
    example: '12:00',
    description: 'Hora de inicio del tramo afectado (HH:MM). Si es null, aplica a todo el día',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'startTime debe tener formato HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({
    example: '13:00',
    description: 'Hora de fin del tramo afectado (HH:MM). Si es null, aplica a todo el día',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'endTime debe tener formato HH:MM' })
  endTime?: string;

  @ApiProperty({
    example: true,
    description: 'true = cierra el día/tramo. false = modifica capacidad u horario',
  })
  @IsBoolean()
  isClosed: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Capacidad alternativa (solo si is_closed=false)',
    minimum: 0,
  })
  @ValidateIf((o) => !o.isClosed)
  @IsInt()
  @Min(0)
  @IsOptional()
  capacityOverride?: number;

  @ApiPropertyOptional({
    example: 'Feriado nacional',
    description: 'Razón o comentario',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
