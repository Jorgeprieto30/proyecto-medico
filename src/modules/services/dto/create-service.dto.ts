import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Spinning' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Clase de spinning con bicicletas numeradas' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'America/Santiago',
    description: 'Zona horaria IANA válida (ej: America/Santiago, UTC)',
  })
  @IsString()
  @IsNotEmpty()
  timezone: string;

  @ApiProperty({
    example: 60,
    description: 'Duración de cada bloque en minutos (ej: 30, 60, 90)',
    minimum: 5,
    maximum: 480,
  })
  @IsInt()
  @Min(5)
  @Max(480)
  slotDurationMinutes: number;

  @ApiProperty({
    example: 20,
    description: 'Cupos máximos por sesión (1–500). Cambiarlo borra todos los overrides por sesión.',
    minimum: 1,
    maximum: 500,
  })
  @IsInt()
  @Min(1)
  @Max(500)
  maxSpots: number;

  @ApiPropertyOptional({
    example: 'Bici',
    description: 'Etiqueta para cada cupo (ej: "Bici" → "Bici 1", "Bici 2"…). Opcional.',
  })
  @IsString()
  @IsOptional()
  spotLabel?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Activar el plazo mínimo de reserva' })
  @IsBoolean()
  @IsOptional()
  bookingCutoffEnabled?: boolean;

  @ApiPropertyOptional({
    example: 'hours',
    enum: ['hours', 'day_before'],
    description: '"hours" = cerrar reservas X horas antes. "day_before" = cerrar el día anterior a las 00:01.',
  })
  @IsIn(['hours', 'day_before'])
  @IsOptional()
  bookingCutoffMode?: 'hours' | 'day_before';

  @ApiPropertyOptional({
    example: 24,
    description: 'Horas mínimas de anticipación (solo cuando bookingCutoffMode = "hours"). Default: 24.',
    minimum: 0,
    maximum: 168,
  })
  @IsInt()
  @Min(0)
  @Max(168)
  @IsOptional()
  bookingCutoffHours?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Días de anticipación para el cierre (solo cuando bookingCutoffMode = "day_before"). Default: 1.',
    minimum: 1,
    maximum: 30,
  })
  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  bookingCutoffDays?: number;
}
