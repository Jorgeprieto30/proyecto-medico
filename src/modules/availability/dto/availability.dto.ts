import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsString, Matches } from 'class-validator';

export class AvailabilityByDateQuery {
  @ApiProperty({ example: 1, description: 'ID del servicio' })
  @IsInt()
  serviceId: number;

  @ApiProperty({ example: '2026-03-20', description: 'Fecha a consultar (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date debe tener formato YYYY-MM-DD' })
  date: string;
}

export class AvailabilityBySlotQuery {
  @ApiProperty({ example: 1, description: 'ID del servicio' })
  @IsInt()
  serviceId: number;

  @ApiProperty({
    example: '2026-03-20T09:00:00-03:00',
    description: 'Fecha y hora ISO 8601 del inicio del bloque',
  })
  @IsString()
  @IsNotEmpty()
  datetime: string;
}

export class SlotAvailabilityDto {
  @ApiProperty({ example: '2026-03-20T08:00:00-03:00' })
  slot_start: string;

  @ApiProperty({ example: '2026-03-20T09:00:00-03:00' })
  slot_end: string;

  @ApiProperty({ example: 5 })
  capacity: number;

  @ApiProperty({ example: 2 })
  reserved: number;

  @ApiProperty({ example: 3 })
  available: number;

  @ApiProperty({ example: true })
  bookable: boolean;
}

export class SlotDetailDto extends SlotAvailabilityDto {
  @ApiProperty({ example: true, description: 'true si el slot existe y está habilitado' })
  exists: boolean;
}
