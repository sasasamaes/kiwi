import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from '../health/health.service';

describe('HealthService — schema drift', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
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
