import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpsertSessionOverrideDto {
  @ApiProperty({ example: '2026-03-25T14:00:00.000Z', description: 'UTC ISO timestamp del inicio del slot' })
  @IsString()
  @IsNotEmpty()
  slot_start: string;

  @ApiProperty({ example: 25, description: 'Cupos máximos para esta sesión específica' })
  @IsInt()
  @Min(1)
  max_spots: number;
}
