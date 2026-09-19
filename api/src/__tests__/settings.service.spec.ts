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
    expect(prisma.platformSetting.upsert).toHaveBeenCalledTimes(4);

    await expect(service.saveAll({ intruso: true } as any)).rejects.toThrow(BadRequestException);
  });
});
