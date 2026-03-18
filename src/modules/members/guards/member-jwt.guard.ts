import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MemberJwtGuard extends AuthGuard('member-jwt') {}
