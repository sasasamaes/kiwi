import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsService, DEFAULT_SETTINGS } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      platformSetting: { findMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (arg: any) => Promise.all(arg)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('getAll devuelve defaults cuando no hay filas', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);

    const res = await service.getAll();

    expect(res).toEqual(DEFAULT_SETTINGS);
  });

  it('getAll fusiona guardados sobre defaults', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'payments', value: { sinpeEnabled: false } },
    ]);

    const res = await service.getAll();

    expect(res.payments.sinpeEnabled).toBe(false);
    expect(res.payments.cardEnabled).toBe(true);
  });

  it('getPaymentAvailability refleja los toggles', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'payments', value: { cashEnabled: false } },
    ]);

    const res = await service.getPaymentAvailability();

    expect(res).toEqual({ sinpe: true, card: true, cash: false, crypto: true });
  });

  it('saveAll persiste por sección y rechaza claves raras', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);
    prisma.platformSetting.upsert.mockImplementation(async (a: any) => a);

    const res = await service.saveAll({
      payments: { ...DEFAULT_SETTINGS.payments, sinpeEnabled: false },
    } as any);

    expect(res.payments.sinpeEnabled).toBe(false);
    expect(prisma.platformSetting.upsert).toHaveBeenCalledTimes(5); // 5 secciones

    await expect(service.saveAll({ intruso: true } as any)).rejects.toThrow(BadRequestException);
  });

  it('saveAll sanea los costos operativos (operations)', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);
    prisma.platformSetting.upsert.mockImplementation(async (a: any) => a);

    const res = await service.saveAll({
      operations: {
        fixedMonthlyCost: -500, // negativo → 0
        supportPerTrip: 12.7, // redondeo → 13
        gatewayPct: 250, // > 100 → 100
        digitalPct: -3, // → 0
      },
    } as any);

    expect(res.operations.fixedMonthlyCost).toBe(0);
    expect(res.operations.supportPerTrip).toBe(13);
    expect(res.operations.gatewayPct).toBe(100);
    expect(res.operations.digitalPct).toBe(0);
  });

  it('getAll fusiona operations guardadas sobre defaults', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'operations', value: { fixedMonthlyCost: 200000 } },
    ]);

    const res = await service.getAll();

    expect(res.operations.fixedMonthlyCost).toBe(200000);
    expect(res.operations.gatewayPct).toBe(2.9); // default intacto
  });

  it('getDriverCommissionPct: default 15, respeta guardado y sanea', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(15);

    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 20 } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(20);

    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 999 } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(100);

    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 'no-numérico' } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(15);
  });
});
