/**
 * @MemberAuth()
 *
 * Combina @Public() + @UseGuards(MemberJwtGuard) + @ApiBearerAuth() en un solo decorador.
 *
 * Por qué necesitamos @Public():
 *   El guard global JwtAuthGuard protege todos los endpoints con tokens de admin.
 *   Los endpoints de miembro usan un token distinto (member-jwt), por lo que deben
 *   saltar el guard global y usar MemberJwtGuard en su lugar.
 *   @Public() le dice al guard global que no intervenga; MemberJwtGuard maneja la auth.
 */
import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MemberJwtGuard } from '../guards/member-jwt.guard';
import { Public } from '../../auth/decorators/public.decorator';

export function MemberAuth() {
  return applyDecorators(
    Public(),
    UseGuards(MemberJwtGuard),
    ApiBearerAuth(),
  );
}
