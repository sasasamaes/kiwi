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
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { findDeliveryZone } from '../orders/delivery-zones';
import { normalizeCRPhone } from '../common/phone';
import { isMerchantCategory, tagMerchantCategory } from '../merchants/merchant-category';

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
    private mailService: MailService,
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
    const {
      email,
      password,
      phone,
      fullName,
      role,
      businessName,
      vehicleType,
      citySlug,
      defaultAddress,
    } = registerDto as RegisterDto & { citySlug?: string; defaultAddress?: string };
    // GPS del registro (opcional): solo se guarda si viene par válido.
    const regLat = Number((registerDto as any).latitude);
    const regLng = Number((registerDto as any).longitude);
    const hasGps =
      Number.isFinite(regLat) &&
      Number.isFinite(regLng) &&
      Math.abs(regLat) <= 90 &&
      Math.abs(regLng) <= 180;
    // Barrio de entrega (opcional): solo ids del catálogo; inválidos se
    // ignoran para no bloquear el registro.
    const zoneId = (registerDto as any).deliveryZone;
    const validZone = typeof zoneId === 'string' && findDeliveryZone(zoneId)?.id;

    // El email es case-insensitive (Postgres unique sí distingue): se
    // normaliza al guardar para que Local@x.com y local@x.com no creen
    // dos cuentas ni burlen el throttle de login.
    const emailNorm = email.trim().toLowerCase();
    // Normalizado a 8888-8888 para que +506 7219 9768 y 72199768 no creen
    // dos cuentas distintas del mismo número.
    const phoneNorm = normalizeCRPhone(phone?.trim() || '') ?? undefined;

    // Email único global; teléfono único POR ROL (la misma persona puede
    // tener cuenta cliente + comercio + repartidor con el mismo número).
    const existingEmail = emailNorm
      ? await this.prisma.user.findFirst({ where: { email: emailNorm } })
      : null;
    if (existingEmail) {
      throw new ConflictException('El correo ya está registrado');
    }
    if (phoneNorm) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: phoneNorm, role: role as any },
      });
      if (existingPhone) {
        throw new ConflictException('Ese teléfono ya está registrado en una cuenta de este tipo');
      }
    }

    // Minimización: el nombre personal es requerido solo para repartidores
    // (nombre público ante comercios/clientes). El comercio se identifica con
    // su nombre de negocio.
    if (role === 'driver' && !fullName?.trim()) {
      throw new BadRequestException('El nombre completo es requerido para repartidores');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Ciudad operativa: default nicoya; si viene otra, validar que exista y esté activa.
    // Si no existe, caer a nicoya para no bloquear el registro.
    let citySlugNorm = (citySlug || 'nicoya').trim().toLowerCase();
    try {
      const city = await this.prisma.city.findUnique({ where: { slug: citySlugNorm } });
      if (!city) citySlugNorm = 'nicoya';
    } catch {
      citySlugNorm = 'nicoya';
    }

    // Create user with profile
    const profileData =
      role === 'merchant'
        ? {
            merchantProfile: {
              create: {
                businessName: businessName || 'Mi Negocio',
                address: 'Nicoya, Guanacaste',
                kycStatus: 'pending' as any,
                citySlug: citySlugNorm,
                // Categoría: si viene válida se respeta, si no se autotaguea
                // por nombre (igual que la migración de existentes).
                category: (isMerchantCategory((registerDto as any).category)
                  ? (registerDto as any).category
                  : tagMerchantCategory(businessName)) as any,
              },
            },
          }
        : role === 'customer'
          ? {
              customerProfile: {
                create: {
                  fullName: fullName?.trim() || null,
                  defaultAddress: defaultAddress?.trim() || null,
                  citySlug: citySlugNorm,
                  ...(hasGps ? { latitude: regLat, longitude: regLng } : {}),
                  ...(validZone ? { deliveryZone: validZone } : {}),
                },
              },
            }
          : {
              driverProfile: {
                create: {
                  fullName,
                  vehicleType: (vehicleType as any) || 'motorcycle',
                  level: 'bronce' as any,
                  rating: 5.0,
                  totalTrips: 0,
                  status: 'offline' as any,
                  kycStatus: 'pending' as any,
                },
              },
            };
    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        phone: phoneNorm,
        passwordHash,
        role: role as any,
        status: 'active',
        ...profileData,
      },
      include: {
        merchantProfile: true,
        driverProfile: true,
        customerProfile: true,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user as any);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const emailKey = email.trim().toLowerCase();

    // Find user (por la forma normalizada: el unique de Postgres
    // distingue mayúsculas y el registro ya guarda minúsculas).
    const user = await this.prisma.user.findUnique({
      where: { email: emailKey },
      include: {
        merchantProfile: true,
        driverProfile: true,
        customerProfile: true,
      },
    });

    if (!user) {
      // Sin cuenta no hay contraseña que verificar: el gate en memoria
      // frena el barrido de emails sin negar nada a un dueño real.
      this.assertNotLocked(emailKey);
      this.recordFailedAttempt(emailKey);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // La contraseña correcta SIEMPRE entra (y limpia el throttle): el costo
    // del bloqueo lo paga quien falla, nunca el dueño. Solo el fallo suma.
    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (isPasswordValid) {
      if (user.status !== 'active') {
        throw new UnauthorizedException('Credenciales inválidas');
      }
      // Successful login: reset the account's failed-attempt state.
      this.clearAttempts(emailKey);
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, loginLockedUntil: null },
        });
      } catch {
        // best-effort: el login igual procede
      }

      // Generate tokens
      const tokens = await this.generateTokens(user as any);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    }

    this.recordFailedAttempt(emailKey);
    await this.recordDbFailedAttempt(user.id);
    // Recién ahora se niega por bloqueo: quien falló paga el 429, el dueño
    // con la clave correcta nunca llega a esta rama.
    this.assertNotLocked(emailKey);
    try {
      const fresh = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { loginLockedUntil: true },
      });
      const until = (fresh as any)?.loginLockedUntil
        ? new Date((fresh as any).loginLockedUntil).getTime()
        : 0;
      if (until > Date.now()) {
        const retryAfter = Math.ceil((until - Date.now()) / 1000);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message:
              'Cuenta temporalmente bloqueada por intentos fallidos. Intenta en unos minutos.',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw e;
      // best-effort: sin lectura fresca, el gate en memoria ya decidió
    }
    throw new UnauthorizedException('Credenciales inválidas');
  }

  /**
   * Throttle persistente: al 5º fallo bloquea 15 min en DB. Corre junto al
   * Map en memoria (que cubre emails inexistentes y picos entre requests).
   */
  private async recordDbFailedAttempt(userId: string) {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 } },
        select: { failedLoginAttempts: true },
      });
      if ((updated?.failedLoginAttempts ?? 0) >= LOGIN_MAX_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            failedLoginAttempts: 0,
            loginLockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS),
          },
        });
      }
    } catch {
      // best-effort: el throttle en memoria sigue valiendo
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        merchantProfile: true,
        driverProfile: true,
        customerProfile: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return this.sanitizeUser(user);
  }

  /**
   * Par de tokens: access de 7 días (lleva tokenVersion para revocación
   * inmediata vía logout global) + refresh opaco rotativo (7 días, un solo
   * uso, ventana deslizante). En DB solo vive el hash del refresh: si se
   * filtra, los tokens vivos no sirven. Con esto el comercio queda logueado
   * una semana sin reingresar credenciales.
   */
  private async generateTokens(user: { id: string; email: string | null; role: string }) {
    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    });
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      v: fresh?.tokenVersion ?? 0,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '7d') as any,
    });

    const refreshValue = randomBytes(48).toString('hex');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(refreshValue).digest('hex'),
        expiresAt: new Date(Date.now() + this.parseDurationMs(refreshExpiresIn, 7 * 24 * 3600_000)),
      },
    });

    return {
      accessToken,
      refreshToken: refreshValue,
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '7d'),
    };
  }

  private parseDurationMs(raw: string, fallbackMs: number): number {
    const m = /^(\d+)([smhd])$/.exec(String(raw ?? '').trim());
    if (!m) return fallbackMs;
    const n = Number(m[1]);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
    return n * mult[m[2] as keyof typeof mult];
  }

  /**
   * Rota un refresh: el presentado se revoca y se emite un par nuevo.
   * Detección de robo: si el token ya estaba revocado CON reemplazo, alguien
   * lo reusó → se revoca toda la familia (todas las sesiones) y 401.
   */
  async refresh(refreshToken: string) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh inválido');
    }
    const hash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored) throw new UnauthorizedException('Refresh inválido');
    if (stored.revokedAt) {
      if (stored.replacedBy) {
        // Reuso de un token ya rotado = posible robo: tumbar todo.
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.prisma.user.update({
          where: { id: stored.userId },
          data: { tokenVersion: { increment: 1 } },
        });
      }
      throw new UnauthorizedException('Sesión terminada. Iniciá sesión de nuevo.');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesión vencida. Iniciá sesión de nuevo.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { merchantProfile: true, driverProfile: true },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Cuenta no disponible');
    }

    const tokens = await this.generateTokens(user as any);
    const nextHash = createHash('sha256').update(tokens.refreshToken).digest('hex');
    // Revocación condicional: si otro request rotó este mismo token en el
    // medio, count===0 y se trata como reuso (posible robo).
    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedBy: nextHash },
    });
    if (revoked.count === 0) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.user.update({
        where: { id: stored.userId },
        data: { tokenVersion: { increment: 1 } },
      });
      throw new UnauthorizedException('Sesión terminada. Iniciá sesión de nuevo.');
    }

    return { user: this.sanitizeUser(user), ...tokens };
  }

  /**
   * Logout global: revoca todos los refresh y sube tokenVersion (mata los
   * access vivos, que igual expiran en 7 días). Cerrar sesión cierra en
   * todos los dispositivos.
   */
  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { success: true };
  }

  /**
   * Recupero por email. Anti-enumeración: siempre responde igual, exista o
   * no la cuenta. Si existe y está activa, invalida tokens viejos, crea uno
   * nuevo (1 hora, un solo uso, solo hash en DB) y manda el link.
   */
  async requestPasswordReset(email: string): Promise<{ sent: boolean }> {
    const emailKey = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) {
      throw new BadRequestException('Email inválido');
    }
    const user = await this.prisma.user.findUnique({ where: { email: emailKey } });
    if (user && (user as any).status === 'active' && (user as any).email) {
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const raw = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(raw).digest('hex');
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const base =
        this.configService.get<string>('WEB_URL') ??
        this.configService.get<string>('FRONTEND_URL') ??
        'http://localhost:3000';
      await this.mailService.sendPasswordReset(
        (user as any).email,
        `${base.replace(/\/$/, '')}/reset-password?token=${raw}`,
      );
    }
    return { sent: true };
  }

  /**
   * Canjea el token por una contraseña nueva. Un solo uso, 1 hora de vida.
   * Revoca sesiones (tokenVersion++) y limpia el throttle de login.
   */
  async resetPassword(token: string, password: string): Promise<{ reset: boolean }> {
    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestException('La contraseña debe tener al menos 6 caracteres');
    }
    if (password.length > 128) {
      throw new BadRequestException('La contraseña no puede superar 128 caracteres');
    }
    if (typeof token !== 'string' || token.length < 32) {
      throw new BadRequestException('Token inválido o vencido');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row: any = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (
      !row ||
      row.usedAt ||
      new Date(row.expiresAt).getTime() <= Date.now() ||
      !row.user ||
      row.user.status !== 'active'
    ) {
      throw new BadRequestException('Token inválido o vencido');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          loginLockedUntil: null,
          tokenVersion: { increment: 1 },
        },
      }),
    ]);
    return { reset: true };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
