import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordMemberDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
