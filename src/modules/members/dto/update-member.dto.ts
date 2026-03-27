import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'María' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ example: 'González' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  last_name?: string;

  @ApiPropertyOptional({ example: '12345678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rut?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  birth_date?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  current_password: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  new_password: string;
}
