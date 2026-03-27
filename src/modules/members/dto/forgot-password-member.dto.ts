import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class ForgotPasswordMemberDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;
}
