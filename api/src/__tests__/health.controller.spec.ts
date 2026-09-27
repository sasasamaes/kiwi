// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health/health.controller';
import { HealthService, SocketTransportReport } from '../health/health.service';
import { PrismaService } from '../prisma/prisma.service';

const okReport: SocketTransportReport = {
  status: 'ok',
  checkedAt: new Date().toISOString(),
  adapter: 'installed',
  handshake: 'ok',
};

const brokenReport: SocketTransportReport = {
  status: 'error',
  checkedAt: new Date().toISOString(),
  adapter: 'missing',
  handshake: 'not_mounted',
  detail: 'NestJS gateway registered but @nestjs/platform-socket.io is not installed',
};

describe('HealthController — socket-aware liveness', () => {
  let controller: HealthController;
  let healthService: { getSocketTransportReport: jest.Mock };
  let res: { status: jest.Mock; json: jest.Mock };

  beforeEach(async () => {
    healthService = { getSocketTransportReport: jest.fn().mockResolvedValue(okReport) };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn((payload) => payload) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: healthService },
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns 200 with socket:ok when the transport is mounted', async () => {
    const body = await controller.getHealth(res as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(body.status).toBe('ok');
    expect(body.socket).toEqual(okReport);
  });

  it('returns 503 with the diagnostic body when the transport is broken', async () => {
    healthService.getSocketTransportReport.mockResolvedValue(brokenReport);

    const body = await controller.getHealth(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(body.status).toBe('error');
    expect((body.socket as any).adapter).toBe('missing');
  });

  it('exposes the deep diagnostics endpoint verbatim', async () => {
    healthService.getSocketTransportReport.mockResolvedValue(brokenReport);

    const report = await controller.getSocketHealth();

    expect(report).toEqual(brokenReport);
  });
});
