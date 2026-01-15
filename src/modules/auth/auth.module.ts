import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { JwtAccessStrategy } from '../../common/strategy/jwt-access.strategy';
import { JwtRefreshStrategy } from '../../common/strategy/jwt-refresh.strategy';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guard/jwt-refresh.guard';
import { RolesGuard } from '../../common/guard/roles.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'secret',
        signOptions: { expiresIn: '15m' },
      }),
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    RolesGuard,
    Reflector,
  ],
})
export class AuthModule {}
