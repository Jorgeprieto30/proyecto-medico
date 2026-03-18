import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { ReservationStatus } from '../entities/reservation.entity';

export class ListReservationsQuery {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  service_id?: string;

  @ApiPropertyOptional({ example: '2026-03-20' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date debe tener formato YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;
}
