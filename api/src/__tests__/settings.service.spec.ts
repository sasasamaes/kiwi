// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService, DEFAULT_SETTINGS } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;
  let configGet: jest.Mock;

  beforeEach(async () => {
    prisma = {
      platformSetting: { findMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (arg: any) => Promise.all(arg)),
    };
    configGet = jest.fn().mockReturnValue('onvo_test_key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
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

    expect(res).toEqual({
      sinpe: true,
      card: true,
      cash: false,
      crypto: true,
      onvoConfigured: true,
    });
  });

  it('getPaymentAvailability apaga tarjeta/SINPE sin llave de Onvo', async () => {
    configGet.mockReturnValue(undefined);
    prisma.platformSetting.findMany.mockResolvedValue([]);

    const res = await service.getPaymentAvailability();

    expect(res).toEqual({
      sinpe: false,
      card: false,
      cash: true,
      crypto: true,
      onvoConfigured: false,
    });
  });

  it('saveAll persiste por sección y rechaza claves raras', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);
    prisma.platformSetting.upsert.mockImplementation(async (a: any) => a);

    const res = await service.saveAll({
      payments: { ...DEFAULT_SETTINGS.payments, sinpeEnabled: false },
    } as any);

    expect(res.payments.sinpeEnabled).toBe(false);
    expect(prisma.platformSetting.upsert).toHaveBeenCalledTimes(6); // 6 secciones

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

    // La caché de 45s es por diseño en prod; en test se limpia entre lecturas.
    service.clearCache();
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 20 } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(20);

    service.clearCache();
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 999 } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(100);

    service.clearCache();
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { commission: 'no-numérico' } },
    ]);
    await expect(service.getDriverCommissionPct()).resolves.toBe(15);
  });

  it('getMandadosEnabled default true y respeta el apagado', async () => {
    prisma.platformSetting.findMany.mockResolvedValue([]);
    await expect(service.getMandadosEnabled()).resolves.toBe(true);

    service.clearCache();
    prisma.platformSetting.findMany.mockResolvedValue([
      { key: 'platform', value: { mandadosEnabled: false } },
    ]);
    await expect(service.getMandadosEnabled()).resolves.toBe(false);
  });
});
