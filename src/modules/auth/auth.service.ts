import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async register(dto: RegisterDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.userModel.create({ ...dto, password: hashed });
    const payload = { sub: created._id, role: created.role };
    const tokens = this.generateTokens(payload);
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) {
      throw new UnauthorizedException('Email already exists');
    }else{
      return {
      ...tokens,
      user: {
        _id: created._id,
        email: created.email,
        name: created.name,
        role: created.role
      }
    };
  }
}

  async validateUser(email: string, pass: string) {
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) return null;
    const match = await bcrypt.compare(pass, user.password);
    if (!match) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user._id, role: user.role };
    const tokens = this.generateTokens(payload);
    return {
      ...tokens,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.userModel.findById(decoded.sub);
      if (!user) throw new UnauthorizedException('User not found');
      
      const payload = { sub: user._id, role: user.role };
      return {
        accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
        refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    return this.userModel.findById(userId);
  }

  generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }
}
