import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ModuleRef } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'] ?? '';

    // Si el token empieza con ak_ es una API key, no un JWT
    if (authHeader.startsWith('Bearer ak_')) {
      const raw = authHeader.slice(7);
      const apiKeysService = this.moduleRef.get(ApiKeysService, { strict: false });
      const apiKey = await apiKeysService.validateKey(raw);
      if (!apiKey) return false;
      request.user = apiKey.user;
      return true;
    }

    // Flujo JWT normal
    return super.canActivate(context) as Promise<boolean>;
  }
}
