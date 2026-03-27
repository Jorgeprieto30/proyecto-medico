import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID del servicio (UUID)' })
  @IsUUID()
  service_id: string;

  @ApiProperty({
    example: '2026-03-20T09:00:00-03:00',
    description: 'Fecha y hora ISO 8601 del inicio del bloque a reservar',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  slot_start: string;

  @ApiPropertyOptional({ example: 'María González' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  customer_name?: string;

  @ApiPropertyOptional({ example: 'client_123' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  customer_external_id?: string;

  @ApiPropertyOptional({ example: 5, description: 'Número de cupo a reservar (1..max_spots). Omitir para auto-asignación cuando el servicio no requiere selección de cupo.' })
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  spot_number?: number;

  @ApiPropertyOptional({ example: { source: 'internal' }, description: 'Objeto plano con datos adicionales (máx. 10 claves)' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string | number | boolean | null>;
}
