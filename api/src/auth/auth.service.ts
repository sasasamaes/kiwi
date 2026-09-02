import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, phone, fullName, role, businessName, vehicleType } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { phone },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('El correo o teléfono ya está registrado');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: role as any,
        status: 'active',
        ...(role === 'merchant'
          ? {
              merchantProfile: {
                create: {
                  businessName: businessName || 'Mi Negocio',
                  address: 'Nicoya, Guanacaste',
                  kycStatus: 'pending',
                },
              },
            }
          : {
              driverProfile: {
                create: {
                  fullName,
                  vehicleType: (vehicleType as any) || 'motorcycle',
                  level: 'bronce',
                  rating: 5.0,
                  totalTrips: 0,
                  status: 'offline',
                  kycStatus: 'pending',
                },
              },
            }),
      },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Tu cuenta está desactivada');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return this.sanitizeUser(user);
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      expiresIn: '7d',
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
