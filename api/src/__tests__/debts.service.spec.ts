// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DebtsService } from '../debts/debts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DebtsService', () => {
  let service: DebtsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      debt: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      debtPayment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      debtParticipant: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      debtExpense: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      driverProfile: { findUnique: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DebtsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DebtsService>(DebtsService);
  });

  it('create rechaza montos inválidos', async () => {
    await expect(
      service.create({
        title: 'Moto',
        totalAmount: 0,
        monthlyAmount: 50000,
        startDate: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({
        title: 'Moto',
        totalAmount: 1000000,
        monthlyAmount: -5,
        startDate: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create({
        title: '   ',
        totalAmount: 1000000,
        monthlyAmount: 50000,
        startDate: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create guarda la deuda con prima y plazo', async () => {
    prisma.debt.create.mockResolvedValue({
      id: 'd1',
      title: 'Moto',
      description: null,
      totalAmount: 1500000,
      monthlyAmount: 75000,
      downPayment: 200000,
      startDate: new Date('2026-10-01'),
      termMonths: 20,
      createdAt: new Date(),
    });
    const res = await service.create({
      title: 'Moto',
      totalAmount: 1500000,
      monthlyAmount: 75000,
      downPayment: 200000,
      startDate: '2026-10-01',
      termMonths: 20,
    });
    expect(res.summary.total).toBe(1500000);
    expect(res.summary.downPayment).toBe(200000);
    expect(res.summary.balance).toBe(1300000);
  });

  it('summarize deriva saldo, avance y aportes por repartidor', () => {
    const debt = { totalAmount: 1000000, downPayment: 100000, monthlyAmount: 90000 };
    const payments = [
      { amount: 90000, kind: 'cuota', driverId: null, driver: null },
      {
        amount: 50000,
        kind: 'aporte',
        driverId: 'drv-luis',
        driver: { fullName: 'Luis Espinoza' },
      },
      {
        amount: 30000,
        kind: 'aporte',
        driverId: 'drv-fran',
        driver: { fullName: 'Francisco Campos' },
      },
    ];
    const s: any = (service as any).summarize(debt, payments);
    expect(s.paid).toBe(170000);
    expect(s.paidTotal).toBe(270000);
    expect(s.balance).toBe(730000);
    expect(s.pct).toBe(27);
    expect(s.settled).toBe(false);
    expect(s.monthsLeft).toBe(9);
    expect(s.byKind).toEqual({ cuota: 90000, aporte: 80000, extra: 0 });
    expect(s.byDriver[0]).toEqual({ driverId: 'drv-luis', name: 'Luis Espinoza', total: 50000 });
  });

  it('summarize marca saldada cuando no queda saldo', () => {
    const s: any = (service as any).summarize(
      { totalAmount: 500000, downPayment: 0, monthlyAmount: 50000 },
      [{ amount: 500000, kind: 'cuota', driverId: null, driver: null }],
    );
    expect(s.settled).toBe(true);
    expect(s.balance).toBe(0);
    expect(s.monthsLeft).toBe(0);
  });

  it('addPayment rechaza monto inválido y deuda inexistente', async () => {
    prisma.debt.findUnique.mockResolvedValue(null);
    await expect(service.addPayment('nope', { amount: 10000 })).rejects.toThrow(NotFoundException);
    prisma.debt.findUnique.mockResolvedValue({ id: 'd1' });
    await expect(service.addPayment('d1', { amount: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.addPayment('d1', { amount: 10000, kind: 'raro' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('addPayment liga el aporte al repartidor', async () => {
    prisma.debt.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-luis' });
    prisma.debtPayment.create.mockImplementation(async ({ data }: any) => ({
      id: 'p1',
      ...data,
      driver: { fullName: 'Luis Espinoza' },
      createdAt: new Date(),
    }));
    const res = await service.addPayment(
      'd1',
      { amount: 25000, kind: 'aporte', driverId: 'drv-luis', note: 'De mis viajes' },
      'admin1',
    );
    expect(res.driverId).toBe('drv-luis');
    expect(res.driverName).toBe('Luis Espinoza');
    expect(prisma.debtPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 25000, kind: 'aporte' }),
      }),
    );
  });

  it('addPayment con repartidor inexistente falla', async () => {
    prisma.debt.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.driverProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.addPayment('d1', { amount: 25000, kind: 'aporte', driverId: 'ghost' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('addParticipant asigna al repartidor y lista el roster', async () => {
    prisma.debt.findUnique.mockResolvedValue({ id: 'd1' });
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-luis' });
    prisma.debtParticipant.upsert.mockResolvedValue({});
    prisma.debtParticipant.findMany.mockResolvedValue([
      { driverId: 'drv-luis', joinedAt: new Date(), driver: { fullName: 'Luis Espinoza' } },
    ]);
    const res = await service.addParticipant('d1', 'drv-luis');
    expect(res).toEqual([
      { driverId: 'drv-luis', name: 'Luis Espinoza', joinedAt: expect.any(Date) },
    ]);
  });

  it('addExpense rechaza tipo inválido y acepta gasolina con resumen', async () => {
    prisma.debt.findUnique.mockResolvedValue({ id: 'd1' });
    await expect(service.addExpense('d1', { amount: 5000, kind: 'raro' })).rejects.toThrow(
      BadRequestException,
    );
    prisma.debtExpense.create.mockImplementation(async ({ data }: any) => ({
      id: 'e1',
      ...data,
      driver: null,
      createdAt: new Date(),
    }));
    const today = new Date().toISOString().split('T')[0];
    const res = await service.addExpense('d1', { amount: 8000, kind: 'gasolina', spentAt: today });
    expect(res.amount).toBe(8000);
    expect(res.kind).toBe('gasolina');
  });

  it('summarizeExpenses agrupa gasolina por hoy/semana/mes', async () => {
    const now = new Date();
    const today = now.toISOString();
    const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const rows = [
      { amount: 8000, kind: 'gasolina', spentAt: today },
      { amount: 8000, kind: 'gasolina', spentAt: today },
      { amount: 15000, kind: 'mantenimiento', spentAt: today },
      { amount: 8000, kind: 'gasolina', spentAt: old },
    ];
    const s: any = (service as any).summarizeExpenses(rows);
    expect(s.total).toBe(39000);
    expect(s.byKind).toEqual({ gasolina: 24000, mantenimiento: 15000 });
    expect(s.fuelToday).toBe(16000);
    // el gasto de hace 40 días no entra en semana ni mes corriente
    expect(s.fuelWeek).toBe(16000);
  });
});
