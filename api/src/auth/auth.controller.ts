// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req) {
    const user = await this.authService.validateUser(req.user.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rota el refresh token y emite un par nuevo' })
  @ApiResponse({ status: 201, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh inválido o revocado' })
  async refresh(@Body() body: { refreshToken?: string }) {
    return this.authService.refresh(body?.refreshToken ?? '');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout global: revoca sesiones en todos los dispositivos' })
  async logout(@Request() req) {
    return this.authService.logout(req.user.sub);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Pide el email de recupero (respuesta siempre igual)' })
  @ApiResponse({ status: 201, description: 'Si la cuenta existe, se envió el email' })
  async forgotPassword(@Body() body: { email?: string }) {
    return this.authService.requestPasswordReset(body?.email ?? '');
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Canjea el token por una contraseña nueva' })
  @ApiResponse({ status: 201, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 400, description: 'Token inválido o vencido' })
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    return this.authService.resetPassword(body?.token ?? '', body?.password ?? '');
  }
}
