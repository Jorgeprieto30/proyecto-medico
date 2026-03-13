import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: 1, description: 'ID del servicio' })
  @IsInt()
  @Min(1)
  service_id: number;

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

  @ApiPropertyOptional({ example: { source: 'internal' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
