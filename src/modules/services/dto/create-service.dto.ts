import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Consulta Médica General' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Atención médica general para pacientes' })
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

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
