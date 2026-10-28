// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WithdrawalsService,
  payWeekStart,
  lastClosedWeek,
} from '../withdrawals/withdrawals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('WithdrawalsService transiciones atómicas', () => {
  let service: WithdrawalsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      withdrawal: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyWithdrawalStatus: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
  });

  const row = (status: string) => ({
    id: 'w1',
    status,
    amount: 5000,
    driver: { userId: 'driver-user-1' },
  });

  it('approve reclama pending una sola vez; el segundo intento falla', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));

    const res = await service.approveWithdrawal('w1', 'admin-1');
    expect(res.status).toBe('processing');
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', status: 'pending' } }),
    );

    // Segundo admin concurrente: nadie en pending → error, sin doble pago
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));
    await expect(service.approveWithdrawal('w1', 'admin-2')).rejects.toThrow(BadRequestException);
  });

  it('approve de inexistente da 404', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(null);
    await expect(service.approveWithdrawal('w1', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('complete solo sale de processing', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('completed'));
    const res = await service.completeWithdrawal('w1', 'tx-1');
    expect(res.status).toBe('completed');

    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('completed'));
    await expect(service.completeWithdrawal('w1', 'tx-2')).rejects.toThrow(BadRequestException);
  });

  it('reject solo sale de pending', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('rejected'));
    const res = await service.rejectWithdrawal('w1', 'admin-1', 'motivo');
    expect(res.status).toBe('rejected');

    prisma.withdrawal.updateMany.mockResolvedValue({ count: 0 });
    prisma.withdrawal.findUnique.mockResolvedValue(row('processing'));
    await expect(service.rejectWithdrawal('w1', 'admin-1', 'x')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('payroll weeks (mar–lun, CR)', () => {
  // Tue 2026-10-20 12:00 UTC = Tue 06:00 CR
  const TUE = new Date(Date.UTC(2026, 9, 20, 12));
  // Mon 2026-10-26 12:00 UTC = Mon 06:00 CR
  const MON = new Date(Date.UTC(2026, 9, 26, 12));
  // Sun 2026-10-25
  const SUN = new Date(Date.UTC(2026, 9, 25, 12));

  it('la semana que contiene al miércoles arranca el martes 00:00 CR', () => {
    const start = payWeekStart(new Date(Date.UTC(2026, 9, 21, 12)));
    // Tue Oct 20 00:00 CR = Tue 06:00 UTC
    expect(start.toISOString()).toBe('2026-10-20T06:00:00.000Z');
  });

  it('el domingo pertenece a la semana que arrancó el martes previo', () => {
    expect(payWeekStart(SUN).toISOString()).toBe('2026-10-20T06:00:00.000Z');
  });

  it('el lunes pertenece a la semana que arrancó el martes previo', () => {
    expect(payWeekStart(MON).toISOString()).toBe('2026-10-20T06:00:00.000Z');
  });

  it('el martes a las 00:01 CR ya es semana nueva', () => {
    // Tue Oct 27 00:01 CR = Tue 06:01 UTC
    const start = payWeekStart(new Date(Date.UTC(2026, 9, 27, 6, 1)));
    expect(start.toISOString()).toBe('2026-10-27T06:00:00.000Z');
  });

  it('la última semana cerrada el martes 27 es 20–27 oct', () => {
    const { weekStart, weekEnd } = lastClosedWeek(new Date(Date.UTC(2026, 9, 27, 12)));
    expect(weekStart.toISOString()).toBe('2026-10-20T06:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-10-27T06:00:00.000Z');
  });

  it('la última semana cerrada el lunes 26 es 13–20 oct', () => {
    const { weekStart, weekEnd } = lastClosedWeek(new Date(Date.UTC(2026, 9, 26, 23)));
    expect(weekStart.toISOString()).toBe('2026-10-13T06:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-10-20T06:00:00.000Z');
  });
});

describe('WithdrawalsService payroll', () => {
  let service: WithdrawalsService;
  let prisma: any;

  const order = (over: any = {}) => ({
    id: 'o1',
    driverId: 'drv-1',
    deliveredAt: new Date(Date.UTC(2026, 9, 21, 12)),
    basePrice: 1500,
    driverPayout: 1275,
    totalAmount: 5000,
    merchant: { businessName: 'Soda' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      withdrawalItem: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      withdrawal: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'w1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      driverProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyWithdrawalStatus: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
  });

  it('getPayroll agrupa por repartidor y excluye recibidos y sin driver', async () => {
    prisma.order.findMany.mockResolvedValue([
      order({ id: 'o1', driverPayout: 1275 }),
      order({ id: 'o2', driverPayout: 1275, deliveredAt: new Date(Date.UTC(2026, 9, 22, 12)) }),
      order({ id: 'o3', driverId: 'drv-2', driverPayout: 2000 }),
      order({ id: 'o4', driverId: null }),
    ]);
    prisma.withdrawalItem.findMany.mockResolvedValue([{ orderId: 'o2' }]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
      { id: 'drv-2', fullName: 'Fran', user: { phone: '7777', email: 'f@x.com' } },
    ]);

    const res: any = await service.getPayroll('2026-10-20');

    expect(res.drivers).toHaveLength(2);
    const juan = res.drivers.find((d: any) => d.driverId === 'drv-1');
    expect(juan.tripCount).toBe(1); // o2 ya tiene recibo
    expect(juan.totalPayout).toBe(1275);
    expect(juan.trips[0].id).toBe('o1');
    const fran = res.drivers.find((d: any) => d.driverId === 'drv-2');
    expect(fran.totalPayout).toBe(2000);
    expect(res.weekStart.toISOString()).toBe('2026-10-20T06:00:00.000Z');
    expect(res.weekEnd.toISOString()).toBe('2026-10-27T06:00:00.000Z');
  });

  it('getPayroll con hasta recorta la semana y deja el resto sin recibo', async () => {
    const o1 = order({ id: 'o1', deliveredAt: new Date(Date.UTC(2026, 9, 22, 12)) });
    const o2 = order({ id: 'o2', deliveredAt: new Date(Date.UTC(2026, 9, 26, 12)) });
    // El mock respeta el rango deliveredAt como lo haría Prisma.
    prisma.order.findMany.mockImplementation(async ({ where }: any) => {
      const gte = where?.deliveredAt?.gte ? new Date(where.deliveredAt.gte).getTime() : -Infinity;
      const lt = where?.deliveredAt?.lt ? new Date(where.deliveredAt.lt).getTime() : Infinity;
      return [o1, o2].filter((o) => {
        const t = new Date(o.deliveredAt).getTime();
        return t >= gte && t < lt;
      });
    });
    prisma.withdrawalItem.findMany.mockResolvedValue([]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
    ]);

    const res: any = await service.getPayroll('2026-10-20', false, '2026-10-25');
    expect(res.drivers).toHaveLength(1);
    expect(res.drivers[0].tripCount).toBe(1);
    expect(res.drivers[0].trips[0].id).toBe('o1');
  });

  it('getPayroll arrastra el rezago de semanas anteriores marcado', async () => {
    prisma.order.findMany.mockResolvedValue([
      order({ id: 'viejo', deliveredAt: new Date(Date.UTC(2026, 9, 19, 12)) }),
      order({ id: 'nuevo', deliveredAt: new Date(Date.UTC(2026, 9, 22, 12)) }),
    ]);
    prisma.withdrawalItem.findMany.mockResolvedValue([]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
    ]);

    const res: any = await service.getPayroll('2026-10-20');
    expect(res.drivers).toHaveLength(1);
    expect(res.drivers[0].tripCount).toBe(2);
    expect(res.drivers[0].rezagoCount).toBe(1);
    expect(res.drivers[0].trips.find((t: any) => t.id === 'viejo').rezago).toBe(true);
    expect(res.drivers[0].trips.find((t: any) => t.id === 'nuevo').rezago).toBe(false);
    expect(res.rezagoTotal).toBe(1275);
  });

  it('getPayroll marca retiros ya generados para la semana', async () => {
    prisma.order.findMany.mockResolvedValue([order({})]);
    prisma.withdrawalItem.findMany.mockResolvedValue([]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
    ]);
    prisma.withdrawal.findMany.mockResolvedValue([
      { id: 'w9', driverId: 'drv-1', status: 'processing', amount: 1275 },
    ]);

    const res: any = await service.getPayroll('2026-10-20');
    expect(res.drivers[0].existingWithdrawal.id).toBe('w9');
  });

  it('generatePayroll crea retiro + líneas y no duplica', async () => {
    prisma.order.findMany.mockResolvedValue([order({}), order({ id: 'o2' })]);
    prisma.withdrawalItem.findMany.mockResolvedValue([]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
    ]);
    prisma.withdrawal.findMany.mockResolvedValue([]); // sin existente
    prisma.withdrawal.findFirst
      .mockResolvedValueOnce(null) // dupe check
      .mockResolvedValueOnce(null); // last used

    const res: any = await service.generatePayroll('2026-10-20', undefined as any);

    expect(res.created).toHaveLength(1);
    expect(res.skipped).toHaveLength(0);
    expect(prisma.withdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverId: 'drv-1',
          amount: 2550,
          status: 'pending',
          paymentMethod: 'sinpe',
          sinpePhone: '8888',
        }),
      }),
    );
    expect(prisma.withdrawalItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ orderId: 'o1', amount: 1275 }),
        expect.objectContaining({ orderId: 'o2', amount: 1275 }),
      ],
    });
  });

  it('generatePayroll omite sin viajes y con retiro existente', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    const res: any = await service
      .generatePayroll('2026-10-20', undefined as any)
      .catch((e: any) => e);
    expect(res).toBeInstanceOf(BadRequestException);
  });

  it('completePayrollWeek exige comprobante y completa los pendientes', async () => {
    await expect(service.completePayrollWeek('2026-10-20', '', 'admin-1')).rejects.toThrow(
      'transactionId',
    );
    prisma.withdrawal.findMany.mockResolvedValue([
      { id: 'w1', amount: 2550, driver: { userId: 'u1' } },
      { id: 'w2', amount: 1275, driver: { userId: 'u2' } },
    ]);
    const res: any = await service.completePayrollWeek('2026-10-20', 'SINPE-123', 'admin-1');
    expect(res.completed).toBe(2);
    expect(res.total).toBe(3825);
    expect(prisma.withdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'w1' }),
        data: expect.objectContaining({ status: 'completed', transactionId: 'SINPE-123' }),
      }),
    );
  });

  it('completePayrollWeek falla si no hay nada generado', async () => {
    prisma.withdrawal.findMany.mockResolvedValue([]);
    await expect(service.completePayrollWeek('2026-10-20', 'SINPE-123', 'admin-1')).rejects.toThrow(
      'generá la planilla primero',
    );
  });

  it('getReceipt suma líneas y valida dueño', async () => {
    prisma.withdrawal.findUnique.mockResolvedValue({
      id: 'w1',
      driverId: 'drv-1',
      amount: 2550,
      currency: 'CRC',
      status: 'completed',
      paymentMethod: 'sinpe',
      periodStart: new Date('2026-10-20T06:00:00.000Z'),
      periodEnd: new Date('2026-10-27T06:00:00.000Z'),
      items: [
        {
          orderId: 'o1',
          amount: 1275,
          deliveredAt: new Date('2026-10-21T12:00:00Z'),
          order: { basePrice: 1500, merchant: { businessName: 'Soda' } },
        },
        {
          orderId: 'o2',
          amount: 1275,
          deliveredAt: new Date('2026-10-22T12:00:00Z'),
          order: { basePrice: 1500, merchant: { businessName: 'Soda' } },
        },
      ],
      driver: { fullName: 'Juan', user: { phone: '8888', email: 'j@x.com' } },
    });
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-1' });

    const r: any = await service.getReceipt('w1', { driverUserId: 'u1' });
    expect(r.tripCount).toBe(2);
    expect(r.tripsTotal).toBe(2550);
    expect(r.trips[0].merchant).toBe('Soda');

    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'otro' });
    await expect(service.getReceipt('w1', { driverUserId: 'u2' })).rejects.toThrow();
  });

  it('approve adjunta recibo FIFO a retiros manuales sin líneas', async () => {
    prisma.withdrawal.updateMany.mockResolvedValue({ count: 1 });
    prisma.withdrawal.findUnique.mockResolvedValue({
      id: 'w1',
      driverId: 'drv-1',
      createdAt: new Date('2026-10-27T12:00:00Z'),
      driver: { userId: 'u-drv' },
      status: 'pending',
      amount: 2000,
    });
    prisma.withdrawalItem.count.mockResolvedValue(0);
    prisma.withdrawalItem.findMany.mockResolvedValue([]);
    prisma.order.findMany.mockResolvedValue([
      order({ id: 'oA', driverPayout: 1275 }),
      order({ id: 'oB', driverPayout: 1275 }),
    ]);

    await service.approveWithdrawal('w1', 'admin-1');

    expect(prisma.withdrawalItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ withdrawalId: 'w1', orderId: 'oA' }),
        expect.objectContaining({ withdrawalId: 'w1', orderId: 'oB' }),
      ],
    });
  });
});

describe('WithdrawalsService saldos y puesta en 0', () => {
  let service: WithdrawalsService;
  let prisma: any;

  const order = (over: any = {}) => ({
    id: 'o1',
    driverId: 'drv-1',
    deliveredAt: new Date('2026-10-21T12:00:00Z'),
    basePrice: 1500,
    driverPayout: 1275,
    merchant: { businessName: 'Soda' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      withdrawalItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      withdrawal: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'w0', ...data })),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      driverProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      $executeRaw: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: { notifyWithdrawalStatus: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();

    service = module.get(WithdrawalsService);
  });

  it('getUnsettledBalances agrupa no liquidados y cuenta pendientes', async () => {
    prisma.order.findMany.mockResolvedValue([
      order({ id: 'o1' }),
      order({ id: 'o2', driverPayout: 2000 }),
      order({ id: 'o3', driverId: null }),
    ]);
    prisma.withdrawalItem.findMany.mockResolvedValue([{ orderId: 'o2' }]);
    prisma.driverProfile.findMany.mockResolvedValue([
      { id: 'drv-1', fullName: 'Luis', user: { phone: '8888', email: 'l@x.com' } },
    ]);
    prisma.withdrawal.groupBy.mockResolvedValue([{ driverId: 'drv-1', _count: { id: 2 } }]);

    const res: any = await service.getUnsettledBalances();
    expect(res).toHaveLength(1);
    expect(res[0].driverId).toBe('drv-1');
    expect(res[0].tripCount).toBe(1);
    expect(res[0].totalPayout).toBe(1275);
    expect(res[0].pendingCount).toBe(2);
  });

  it('zeroOut crea retiro completed con recibo y deja saldo en 0', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-1' });
    prisma.withdrawal.count.mockResolvedValue(0);
    prisma.order.findMany.mockResolvedValue([order({}), order({ id: 'o2' })]);

    const res: any = await service.zeroOutDriver('drv-1', 'admin-1', 'cierre pre-lanzamiento');

    expect(prisma.withdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverId: 'drv-1',
          amount: 2550,
          status: 'completed',
          transactionId: expect.stringContaining('AJUSTE'),
        }),
      }),
    );
    expect(prisma.withdrawalItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ orderId: 'o1', amount: 1275 }),
        expect.objectContaining({ orderId: 'o2', amount: 1275 }),
      ],
    });
    expect(res.tripCount).toBe(2);
  });

  it('zeroOut exige resolver pendientes primero y rechaza sin saldo', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'drv-1' });
    prisma.withdrawal.count.mockResolvedValue(1);
    await expect(service.zeroOutDriver('drv-1', 'a', 'x')).rejects.toThrow('pendientes');

    prisma.withdrawal.count.mockResolvedValue(0);
    prisma.order.findMany.mockResolvedValue([]);
    await expect(service.zeroOutDriver('drv-1', 'a', 'x')).rejects.toThrow('No hay saldo');
  });
});
