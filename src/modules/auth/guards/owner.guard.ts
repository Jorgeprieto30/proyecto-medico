import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Solo permite acceso al owner de la plataforma (role === 'owner').
 * Usar después de JwtAuthGuard (requiere req.user cargado).
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user?.role === 'owner') return true;
    throw new ForbiddenException('Acceso restringido al administrador de la plataforma.');
  }
}
