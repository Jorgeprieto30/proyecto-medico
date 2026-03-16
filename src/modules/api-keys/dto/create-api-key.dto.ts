import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integración con app móvil' })
  @IsString()
  @MinLength(1)
  name: string;
}
