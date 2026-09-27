// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Per-account brute-force throttle for login (independent of IP limits). */
interface AttemptEntry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 min sliding window
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout after too many fails

@Injectable()
export class AuthService {
  /** email(lowercased) → failed-attempt state. Wins over any IP rotation. */
  private readonly loginAttempts = new Map<string, AttemptEntry>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // Periodic cleanup so entries for abandoned accounts don't accumulate.
    setInterval(
      () => {
        const now = Date.now();
        for (const [k, e] of this.loginAttempts.entries()) {
          if (now > e.windowStart + LOGIN_WINDOW_MS && now > e.lockedUntil) {
            this.loginAttempts.delete(k);
          }
        }
      },
      10 * 60 * 1000,
    ).unref();
  }

  /**
   * Throttle failed logins per ACCOUNT (email), not per IP: an attacker with
   * many IPs cannot rotate around it, and a shared-office NAT can't lock
   * everyone out. Only failures count; success clears the account's state.
   */
  private assertNotLocked(emailKey: string) {
    const entry = this.loginAttempts.get(emailKey);
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      const retryAfter = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Cuenta temporalmente bloqueada por intentos fallidos. Intenta en unos minutos.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailedAttempt(emailKey: string) {
    const now = Date.now();
    let entry = this.loginAttempts.get(emailKey);
    if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
      entry = { count: 0, windowStart: now, lockedUntil: 0 };
      this.loginAttempts.set(emailKey, entry);
    }
    entry.count++;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOGIN_LOCKOUT_MS;
    }
  }

  private clearAttempts(emailKey: string) {
    this.loginAttempts.delete(emailKey);
  }

  async register(registerDto: RegisterDto) {
    const { email, password, phone, fullName, role, businessName, vehicleType } = registerDto;

    // El email es case-insensitive (Postgres unique sí distingue): se
    // normaliza al guardar para que Local@x.com y local@x.com no creen
    // dos cuentas ni burlen el throttle de login.
    const emailNorm = email.trim().toLowerCase();
    const phoneNorm = phone?.trim() || undefined;

    // Check if user exists
    const orConditions: Array<{ email?: string; phone?: string }> = [];
    if (emailNorm) orConditions.push({ email: emailNorm });
    if (phoneNorm) orConditions.push({ phone: phoneNorm });

    const existingUser = orConditions.length
      ? await this.prisma.user.findFirst({
          where: { OR: orConditions },
        })
      : null;

    if (existingUser) {
      throw new ConflictException('El correo o teléfono ya está registrado');
    }

    // Minimización: el nombre personal es requerido solo para repartidores
    // (nombre público ante comercios/clientes). El comercio se identifica con
    // su nombre de negocio.
    if (role === 'driver' && !fullName?.trim()) {
      throw new BadRequestException('El nombre completo es requerido para repartidores');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        phone: phoneNorm,
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
    const emailKey = email.trim().toLowerCase();

    // Per-account brute-force throttle (IP throttle is separate, in middleware).
    this.assertNotLocked(emailKey);

    // Find user (por la forma normalizada: el unique de Postgres
    // distingue mayúsculas y el registro ya guarda minúsculas).
    const user = await this.prisma.user.findUnique({
      where: { email: emailKey },
      include: {
        merchantProfile: true,
        driverProfile: true,
      },
    });

    if (!user) {
      this.recordFailedAttempt(emailKey);
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
      this.recordFailedAttempt(emailKey);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Successful login: reset the account's failed-attempt state.
    this.clearAttempts(emailKey);

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
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
