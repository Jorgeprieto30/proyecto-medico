import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterMemberDto {
  @ApiProperty({ example: 'Jorge' })
  @IsString()
  @MinLength(1)
  first_name: string;

  @ApiProperty({ example: 'Prieto' })
  @IsString()
  @MinLength(1)
  last_name: string;

  @ApiProperty({ example: 'jorge@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '12345678-9' })
  @IsOptional()
  @IsString()
  rut?: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
