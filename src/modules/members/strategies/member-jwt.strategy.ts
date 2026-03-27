import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MembersService } from '../members.service';

@Injectable()
export class MemberJwtStrategy extends PassportStrategy(Strategy, 'member-jwt') {
  constructor(private readonly membersService: MembersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET env var is required'); })(),
    });
  }

  async validate(payload: { sub: string; type: string }) {
    if (payload.type !== 'member') throw new UnauthorizedException();
    const member = await this.membersService.findById(payload.sub);
    if (!member) throw new UnauthorizedException();
    return member;
  }
}
