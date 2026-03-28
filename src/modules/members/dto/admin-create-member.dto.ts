import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminCreateMemberDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '12.345.678-9' })
  @IsString()
  @IsOptional()
  rut?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsString()
  @IsOptional()
  birth_date?: string;
}
