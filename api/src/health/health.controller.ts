import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService, DriftReport } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Liveness: is the API process up at all.
   */
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
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
}
