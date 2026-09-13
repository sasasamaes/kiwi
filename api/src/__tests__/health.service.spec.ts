import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import * as http from 'node:http';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from '../health/health.service';

describe('HealthService — socket transport', () => {
  let service: HealthService;
  let httpServer: http.Server | undefined;

  const makeModule = async (adapterHostValue: any) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
        { provide: HttpAdapterHost, useValue: adapterHostValue },
      ],
    }).compile();
    return module.get(HealthService);
  };

  afterEach((done) => {
    if (httpServer) {
      httpServer.close(() => done());
      httpServer = undefined;
    } else {
      done();
    }
  });

  it('reports error with adapter:missing when the adapter package is not resolvable', async () => {
    service = await makeModule({ httpAdapter: { getHttpServer: () => null } });
    (service as any).resolveSocketAdapter = () => 'missing';

    const report = await service.getSocketTransportReport();

    expect(report.status).toBe('error');
    expect(report.adapter).toBe('missing');
    expect(report.handshake).toBe('not_mounted');
    expect(report.detail).toContain('platform-socket.io');
  });

  it('reports ok after a real engine.io OPEN-packet handshake (mounted transport)', async () => {
    // Stand-in for the Nest HTTP server: answers the engine.io polling
    // handshake exactly like a mounted socket.io does.
    httpServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('0{"sid":"test","upgrades":["websocket"],"pingInterval":25000}');
    });
    await new Promise<void>((r) => httpServer!.listen(0, '127.0.0.1', r));

    service = await makeModule({
      httpAdapter: { getHttpServer: () => httpServer },
    });

    const report = await service.getSocketTransportReport();

    expect(report.status).toBe('ok');
    expect(report.adapter).toBe('installed');
    expect(report.handshake).toBe('ok');
  });

  it('detects the not_mounted signature (express-style 404 instead of OPEN packet)', async () => {
    // This is EXACTLY what prod answered when the adapter was missing.
    httpServer = http.createServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        '{"message":"Cannot GET /socket.io/?EIO=4&transport=polling","error":"Not Found","statusCode":404}',
      );
    });
    await new Promise<void>((r) => httpServer!.listen(0, '127.0.0.1', r));

    service = await makeModule({
      httpAdapter: { getHttpServer: () => httpServer },
    });

    const report = await service.getSocketTransportReport();

    expect(report.status).toBe('error');
    expect(report.adapter).toBe('installed');
    expect(report.handshake).toBe('not_mounted');
  });

  it('reports unreachable when the HTTP server refuses connections', async () => {
    // A closed server on a fixed port = ECONNREFUSED on probe.
    httpServer = http.createServer((_req, res) => res.end('0{}'));
    const port: number = await new Promise((resolve) => {
      httpServer!.listen(0, '127.0.0.1', () => resolve((httpServer!.address() as any).port));
    });
    httpServer.close();

    service = await makeModule({
      httpAdapter: {
        getHttpServer: () => ({ address: () => ({ address: '127.0.0.1', port }) }),
      },
    });

    const report = await service.getSocketTransportReport();

    expect(report.status).toBe('error');
    expect(report.handshake).toBe('unreachable');
    expect(report.detail).toBeTruthy();
  });
});

describe('HealthService — schema drift', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: HttpAdapterHost, useValue: { httpAdapter: { getHttpServer: () => null } } },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('reports ok when every expected column exists', async () => {
    // Any table the DMMF declares must return its own columns; derive the
    // answer from the DMMF itself so the test does not hardcode the schema.
    const { Prisma } = require('@prisma/client');
    const models = Prisma.dmmf.datamodel.models.filter((m: any) => m.dbName);
    prisma.$queryRaw.mockImplementation(
      (_strings: any, table: string) =>
        Promise.resolve(
          models
            .find((m: any) => m.dbName === table)
            .fields.filter((f: any) => f.kind === 'scalar')
            .map((f: any) => ({ column_name: f.dbName || f.name })),
        ) as any,
    );

    const report = await service.getDriftReport();

    expect(report.status).toBe('ok');
    expect(report.driftedTables).toHaveLength(0);
    expect(report.modelsChecked).toBe(models.length);
    expect(report.checkedAt).toBeTruthy();
  });

  it('detects a missing column (column-level drift)', async () => {
    // Simulate prod missing orders.weight_kg: return all real columns except
    // one scalar column of the orders table.
    const { Prisma } = require('@prisma/client');
    const orders = Prisma.dmmf.datamodel.models.find((m: any) => m.name === 'Order');
    const orderColumns = orders.fields
      .filter((f: any) => f.kind === 'scalar')
      .map((f: any) => f.dbName || f.name);
    const missingColumn = orderColumns.includes('weight_kg') ? 'weight_kg' : orderColumns[0];
    const ordersSet = new Set(orderColumns);
    ordersSet.delete(missingColumn);

    prisma.$queryRaw.mockImplementation((_strings: any, table: string) => {
      if (table === 'orders') {
        return Promise.resolve([...ordersSet].map((column_name) => ({ column_name }))) as any;
      }
      const model = Prisma.dmmf.datamodel.models.find((m: any) => m.dbName === table);
      return Promise.resolve(
        model.fields
          .filter((f: any) => f.kind === 'scalar')
          .map((f: any) => ({ column_name: f.dbName || f.name })),
      ) as any;
    });

    const report = await service.getDriftReport();

    expect(report.status).toBe('drift');
    const ordersDrift = report.driftedTables.find((t) => t.table === 'orders');
    expect(ordersDrift).toBeDefined();
    expect(ordersDrift?.missingColumns).toContain(missingColumn);
  });

  it('reports the whole table as missing when P2021 (table does not exist)', async () => {
    const { Prisma } = require('@prisma/client');
    prisma.$queryRaw.mockImplementation((_strings: any, table: string) => {
      if (table === 'orders') {
        const err: any = new Error('table does not exist');
        err.code = 'P2021';
        return Promise.reject(err) as any;
      }
      const model = Prisma.dmmf.datamodel.models.find((m: any) => m.dbName === table);
      return Promise.resolve(
        model.fields
          .filter((f: any) => f.kind === 'scalar')
          .map((f: any) => ({ column_name: f.dbName || f.name })),
      ) as any;
    });

    const report = await service.getDriftReport();

    expect(report.status).toBe('drift');
    const ordersDrift = report.driftedTables.find((t) => t.table === 'orders');
    expect(ordersDrift).toBeDefined();
    // Every scalar column of the model is reported missing
    expect(ordersDrift?.missingColumns.length).toBeGreaterThan(0);
  });

  it('propagates unexpected DB errors (unreachable DB is not drift)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.getDriftReport()).rejects.toThrow('connection refused');
  });
});
