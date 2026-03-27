import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterMemberDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(1)
  first_name: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @MinLength(1)
  last_name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '12345678-9' })
  @IsOptional()
  @IsString()
  rut?: string;

  @ApiProperty({ example: '1990-05-20' })
  @IsNotEmpty()
  @IsDateString()
  birth_date: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
