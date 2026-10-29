// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from '../drivers/drivers.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags';
import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

const delivered = (over: any = {}) => ({
  id: 'o-' + Math.random().toString(36).slice(2, 6),
  status: 'delivered',
  orderType: 'immediate',
  merchant: { businessName: 'Soda' },
  pickupAddress: 'A',
  deliveryAddress: 'B',
  driverPayout: 1000,
  totalAmount: 1200,
  createdAt: new Date('2026-10-28T20:00:00Z'),
  assignedAt: new Date('2026-10-28T19:30:00Z'),
  deliveredAt: new Date('2026-10-28T20:00:00Z'),
  isTest: false,
  ...over,
});

describe('Pedidos de prueba: ni ganancia ni crédito', () => {
  let drivers: DriversService;
  let payments: PaymentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      driverProfile: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      order: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      driverSchedule: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      withdrawal: { aggregate: jest.fn() },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        upsert: jest.fn(),
      },
      merchantProfile: { findUnique: jest.fn(), updateMany: jest.fn() },
      creditTransaction: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FeatureFlagsService, useValue: { kycRequired: false } },
        {
          provide: SettingsService,
          useValue: { getTestDriverEmails: jest.fn().mockResolvedValue([]) },
        },
        { provide: OnvoPayProvider, useValue: {} },
        { provide: StellarProvider, useValue: {} },
        { provide: CreditsService, useValue: { spend: jest.fn() } },
      ],
    }).compile();

    drivers = module.get(DriversService);
    payments = module.get(PaymentsService);
  });

  it('ganancias excluyen tests (totales y conteos)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });
    const all = [
      delivered({ id: 'o-test', driverPayout: 1275, isTest: true }),
      delivered({ id: 'o-real', driverPayout: 850, isTest: false }),
    ];
    // La DB filtra por where: el mock hace lo mismo.
    prisma.order.findMany.mockImplementation(async ({ where }: any) =>
      where?.isTest === false ? all.filter((o) => !o.isTest) : all,
    );

    const r: any = await drivers.getEarnings('u-1', 'all');
    expect(r.totalEarnings).toBe(850);
    expect(r.totalTrips).toBe(1);
    expect(r.transactions).toHaveLength(1);
    expect(r.transactions[0].id).toBe('o-real');
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isTest: false }) }),
    );
  });

  it('ranking excluye tests', async () => {
    const mk = (driverId: string, isTest: boolean, mins: number) => ({
      driverId,
      assignedAt: new Date('2026-10-28T19:00:00Z'),
      deliveredAt: new Date(new Date('2026-10-28T19:00:00Z').getTime() + mins * 60000),
      isTest,
      driver: { id: driverId, fullName: 'P', photoUrl: null, vehicleType: 'motorcycle' },
    });
    const allMk = [
      mk('dp-1', false, 10),
      mk('dp-1', false, 12),
      mk('dp-1', false, 11),
      mk('dp-2', true, 5),
      mk('dp-2', true, 5),
      mk('dp-2', true, 5),
    ];
    prisma.order.findMany.mockImplementation(async ({ where }: any) =>
      where?.isTest === false ? allMk.filter((o) => !o.isTest) : allMk,
    );

    const r: any = await drivers.getRanking('week');
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isTest: false }) }),
    );
    expect(r.ranking.map((x: any) => x.driverId)).not.toContain('dp-2');
  });

  it('historial expone isTest sin filtrar (flujo completo visible)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'dp-1' });
    prisma.order.count.mockResolvedValue(2);
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'o-test',
        status: 'delivered',
        orderType: 'immediate',
        merchant: null,
        pickupAddress: 'A',
        deliveryAddress: 'B',
        driverPayout: 1275,
        totalAmount: 1275,
        createdAt: new Date(),
        deliveredAt: new Date(),
        isTest: true,
      },
      {
        id: 'o-real',
        status: 'delivered',
        orderType: 'immediate',
        merchant: null,
        pickupAddress: 'A',
        deliveryAddress: 'B',
        driverPayout: 850,
        totalAmount: 850,
        createdAt: new Date(),
        deliveredAt: new Date(),
        isTest: false,
      },
    ]);

    const r: any = await drivers.driverOrders('u-1', {});
    expect(r.items).toHaveLength(2);
    expect(r.items.find((x: any) => x.id === 'o-test').isTest).toBe(true);
    expect(r.items.find((x: any) => x.id === 'o-real').isTest).toBe(false);
  });

  it('cobrar un pedido de prueba se rechaza (ni crédito ni weekly)', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', merchantId: 'm-1', isTest: true });
    await expect(
      payments.createPayment(
        { orderId: 'order-1', method: 'credit', amount: 2000 } as any,
        'user-1',
      ),
    ).rejects.toThrow('prueba');
    expect(prisma.merchantProfile.updateMany).not.toHaveBeenCalled();
  });
});
