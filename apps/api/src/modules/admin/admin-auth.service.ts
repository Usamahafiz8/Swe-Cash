import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { email: dto.email } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isAdmin: true,
    });

    return {
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
