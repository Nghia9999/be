import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => req?.cookies?.refreshToken,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET') || 'secret',
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, role: payload.role };
  }
}
