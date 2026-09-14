import { Controller, Get, Res } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService, DriftReport, SocketTransportReport } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Liveness: process up AND the socket transport actually mounted. A missing
   * @nestjs/platform-socket.io adapter historically shipped unnoticed (REST
   * fine, every WS handshake 404) — this makes such a deploy fail its probe.
   */
  @Public() // liveness probe para Render — sin datos, solo “el proceso vive”
  @Get()
  @ApiOperation({
    summary: 'Liveness probe (503 when the socket transport is not mounted)',
  })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const socket = await this.healthService.getSocketTransportReport();
    if (socket.status === 'error') {
      return res.status(503).json({ status: 'error', socket, timestamp: new Date().toISOString() });
    }
    return { status: 'ok', socket, timestamp: new Date().toISOString() };
  }

  /**
   * Readiness: can we reach the database right now.
   */
  @Get('db')
  @ApiOperation({ summary: 'Database readiness probe' })
  async getDbHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'reachable', timestamp: new Date().toISOString() };
    } catch (error: any) {
      return {
        status: 'error',
        database: 'unreachable',
        code: error?.code ?? 'unknown',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Schema drift: compares the columns the deployed Prisma Client expects
   * against the live database. `drift` here is exactly the failure mode that
   * 500s data routes with P2022 while user.count() still succeeds.
   */
  @Get('schema')
  @ApiOperation({ summary: 'Schema drift report (Prisma Client vs live DB)' })
  async getSchemaDrift(): Promise<DriftReport> {
    return this.healthService.getDriftReport();
  }

  /**
   * Deep socket-transport diagnostics: adapter resolvability + a real engine.io
   * self-handshake. Useful when liveness fails and you need the "why".
   */
  @Get('socket')
  @ApiOperation({ summary: 'Socket transport diagnostics (adapter + self-handshake)' })
  async getSocketHealth(): Promise<SocketTransportReport> {
    return this.healthService.getSocketTransportReport();
  }
}
