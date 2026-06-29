import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor (configService : ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
        throw new Error('JWT_SECRET no está definido');
        }
        super({
            jwtFromRequest : ExtractJwt.fromAuthHeaderAsBearerToken(), 
            ignoreExpiration : false, 
            secretOrKey : secret,
        });
    }

    async validate(payload : any) {
        return {
            id : payload.sub ?? payload.id, 
            email : payload.email, 
            role : payload.role,
            emailVerified: payload.emailVerified,
            isEmailVerified: payload.isEmailVerified,
        }
    }
}
