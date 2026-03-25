import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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
  slot_start: string;

  @ApiPropertyOptional({ example: 'Jorge Prieto' })
  @IsString()
  @IsOptional()
  customer_name?: string;

  @ApiPropertyOptional({ example: 'client_123' })
  @IsString()
  @IsOptional()
  customer_external_id?: string;

  @ApiProperty({ example: 5, description: 'Número de cupo a reservar (1..max_spots del servicio)' })
  @IsInt()
  @Min(1)
  spot_number: number;

  @ApiPropertyOptional({ example: { source: 'internal' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
