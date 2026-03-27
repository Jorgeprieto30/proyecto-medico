import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterMemberDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  first_name: string;

  @ApiProperty({ example: 'González' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  last_name: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '12345678-9' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  rut: string;

  @ApiProperty({ example: '1990-05-20' })
  @IsNotEmpty()
  @IsDateString()
  birth_date: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
