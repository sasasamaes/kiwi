import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CreditsService', () => {
  let service: CreditsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      merchantProfile: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      creditTransaction: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(async (arg: any) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  it('recharge suma saldo y asienta en el libro', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchantProfile.update.mockResolvedValue({ creditBalance: 10000 });
    prisma.creditTransaction.create.mockResolvedValue({});

    const res = await service.recharge('m1', 10000, 'admin1', 'Paquete semanal');

    expect(res.balance).toBe(10000);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 10000, kind: 'recharge' }),
      }),
    );
  });

  it('recharge rechaza montos inválidos', async () => {
    await expect(service.recharge('m1', 0, 'admin1')).rejects.toThrow(BadRequestException);
    await expect(service.recharge('m1', -5, 'admin1')).rejects.toThrow(BadRequestException);
  });

  it('spend descuenta solo si alcanza (atómico)', async () => {
    prisma.merchantProfile.updateMany.mockResolvedValue({ count: 1 });
    prisma.creditTransaction.create.mockResolvedValue({});
    prisma.merchantProfile.findUnique.mockResolvedValue({ creditBalance: 7800 });

    const res = await service.spend('m1', 2200, 'order-1');

    expect(res).toEqual({ spent: 2200, balance: 7800 });
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: -2200, kind: 'spend', orderId: 'order-1' }),
      }),
    );
  });

  it('spend falla con mensaje de recarga si no alcanza', async () => {
    prisma.merchantProfile.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.spend('m1', 2200, 'order-1')).rejects.toThrow(
      'Llamá a Kiwi para recargar',
    );
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });
});
