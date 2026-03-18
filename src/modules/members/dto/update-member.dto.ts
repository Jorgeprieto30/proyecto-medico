import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'Jorge' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Prieto' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  last_name?: string;

  @ApiPropertyOptional({ example: '12345678-9' })
  @IsOptional()
  @IsString()
  rut?: string;
}
