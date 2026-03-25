import { ApiProperty } from '@nestjs/swagger';

export class AvailabilityByDateQuery {
  serviceId: number;
  date: string;
}

export class AvailabilityBySlotQuery {
  serviceId: number;
  datetime: string;
}

export class SlotAvailabilityDto {
  @ApiProperty({ example: '2026-03-20T08:00:00-03:00' })
  slot_start: string;

  @ApiProperty({ example: '2026-03-20T09:00:00-03:00' })
  slot_end: string;

  @ApiProperty({ example: 20 })
  capacity: number;

  @ApiProperty({ example: 2 })
  reserved: number;

  @ApiProperty({ example: 18 })
  available: number;

  @ApiProperty({ example: true })
  bookable: boolean;
}

export class SlotDetailDto extends SlotAvailabilityDto {
  @ApiProperty({ example: true, description: 'true si el slot existe y está habilitado' })
  exists: boolean;
}

export class SpotDto {
  @ApiProperty({ example: 5 })
  number: number;

  @ApiProperty({ example: true })
  available: boolean;
}

export class SlotSpotsDto {
  @ApiProperty()
  service_id: string;

  @ApiProperty({ example: '2026-03-20T08:00:00.000Z' })
  slot_start: string;

  @ApiProperty({ example: '2026-03-20T09:00:00.000Z' })
  slot_end: string;

  @ApiProperty({ example: 20 })
  max_spots: number;

  @ApiProperty({ example: 'Bici', nullable: true })
  spot_label: string | null;

  @ApiProperty({ type: [SpotDto] })
  spots: SpotDto[];
}
