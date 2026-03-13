import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ReservationStatus } from '../entities/reservation.entity';

export class ListReservationsQuery {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  service_id: number;

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
