// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RentalsService } from '../rentals/rentals.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RentalsService', () => {
  let service: RentalsService;
  let prisma: any;

  beforeEach(async () => {
    delete process.env.RENTALS_ENABLED;
    prisma = {
      rentalContract: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      rentalPayment: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      driverProfile: { findUnique: jest.fn() },
      debt: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RentalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RentalsService>(RentalsService);
  });

  it('status refleja el flag y todo bloquea cuando está apagado', async () => {
    expect(service.status()).toEqual({ enabled: false });
    await expect(service.contracts()).rejects.toThrow(ForbiddenException);
    await expect(
      service.create({ driverId: 'd1', weeklyPrice: 30000, startDate: '2026-10-01' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('con flag encendido crea contrato y calcula el pendiente', async () => {
    process.env.RENTALS_ENABLED = 'true';
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-luis' });
    prisma.rentalContract.findFirst.mockResolvedValue(null);
    const start = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    prisma.rentalContract.create.mockImplementation(async ({ data }: any) => ({
      id: 'c1',
      ...data,
      status: 'active',
      endDate: null,
      driver: { fullName: 'Luis Espinoza' },
      debt: null,
      payments: [{ amount: 30000 }, { amount: 30000 }],
      createdAt: new Date(),
    }));
    const res = await service.create({
      driverId: 'drv-luis',
      weeklyPrice: 30000,
      startDate: start.toISOString(),
    });
    // 3 semanas × 30000 = 90000 esperado − 60000 pagado = 30000 debiendo
    expect(res.summary.weeksElapsed).toBe(3);
    expect(res.summary.expected).toBe(90000);
    expect(res.summary.paid).toBe(60000);
    expect(res.summary.due).toBe(30000);
    delete process.env.RENTALS_ENABLED;
  });

  it('no permite dos contratos activos al mismo repartidor', async () => {
    process.env.RENTALS_ENABLED = 'true';
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-luis' });
    prisma.rentalContract.findFirst.mockResolvedValue({ id: 'c0' });
    await expect(
      service.create({ driverId: 'drv-luis', weeklyPrice: 30000, startDate: '2026-10-01' }),
    ).rejects.toThrow(BadRequestException);
    delete process.env.RENTALS_ENABLED;
  });

  it('addPayment valida monto y contrato', async () => {
    process.env.RENTALS_ENABLED = 'true';
    prisma.rentalContract.findUnique.mockResolvedValue(null);
    await expect(service.addPayment('nope', { amount: 10000 })).rejects.toThrow(NotFoundException);
    prisma.rentalContract.findUnique.mockResolvedValue({ id: 'c1' });
    await expect(service.addPayment('c1', { amount: 0 })).rejects.toThrow(BadRequestException);
    prisma.rentalPayment.create.mockImplementation(async ({ data }: any) => ({
      id: 'p1',
      ...data,
      createdAt: new Date(),
    }));
    const res = await service.addPayment('c1', { amount: 15000, note: 'Semana 1' });
    expect(res.amount).toBe(15000);
    delete process.env.RENTALS_ENABLED;
  });
});
