// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreditsService } from '../credits/credits.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';

describe('CreditsService', () => {
  let service: CreditsService;
  let prisma: any;
  let onvo: any;

  beforeEach(async () => {
    prisma = {
      merchantProfile: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      creditTransaction: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
      creditTopup: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: any) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };
    onvo = {
      createCheckoutSession: jest.fn(),
      getCheckoutSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnvoPayProvider, useValue: onvo },
      ],
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
      'Recargá con tarjeta en Mi crédito',
    );
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('createTopup rechaza montos bajo el mínimo', async () => {
    await expect(service.createTopup('user-1', 5000)).rejects.toThrow(BadRequestException);
    expect(prisma.creditTopup.create).not.toHaveBeenCalled();
  });

  it('createTopup crea la recarga pendiente y devuelve el checkout', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1', businessName: 'Soda' });
    prisma.creditTopup.create.mockResolvedValue({ id: 't1' });
    prisma.creditTopup.update.mockResolvedValue({ id: 't1', status: 'pending' });
    onvo.createCheckoutSession.mockResolvedValue({
      success: true,
      checkoutUrl: 'https://onvo/pay/1',
      sessionId: 'sess-1',
    });

    const res = await service.createTopup('user-1', 20000);

    expect(res).toEqual(
      expect.objectContaining({ topupId: 't1', amount: 20000, checkoutUrl: 'https://onvo/pay/1' }),
    );
    expect(onvo.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20000, metadata: { topupId: 't1' } }),
    );
    expect(prisma.creditTopup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: expect.objectContaining({ onvoSessionId: 'sess-1' }),
      }),
    );
  });

  it('createTopup marca failed si Onvo no da checkout', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1', businessName: 'Soda' });
    prisma.creditTopup.create.mockResolvedValue({ id: 't1' });
    prisma.creditTopup.update.mockResolvedValue({ id: 't1', status: 'failed' });
    onvo.createCheckoutSession.mockResolvedValue({ success: false, error: 'Onvo caído' });

    await expect(service.createTopup('user-1', 20000)).rejects.toThrow(BadRequestException);
    expect(prisma.creditTopup.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { status: 'failed' } }),
    );
  });

  it('completeTopup acredita una sola vez (gate atómico)', async () => {
    prisma.creditTopup.findUnique.mockResolvedValue({
      id: 't1',
      merchantId: 'm1',
      amount: 20000,
      status: 'pending',
      createdBy: 'user-1',
    });
    prisma.creditTopup.updateMany.mockResolvedValue({ count: 1 });
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchantProfile.update.mockResolvedValue({ creditBalance: 20000 });
    prisma.creditTransaction.create.mockResolvedValue({});

    const first = await service.completeTopup('t1', 'pi-1');
    expect(first).toBe(true);
    expect(prisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 20000, kind: 'recharge' }),
      }),
    );

    // Segunda carrera (webhook + polling): no vuelve a acreditar.
    prisma.creditTopup.findUnique.mockResolvedValue({
      id: 't1',
      merchantId: 'm1',
      amount: 20000,
      status: 'completed',
      createdBy: 'user-1',
    });
    const second = await service.completeTopup('t1', 'pi-1');
    expect(second).toBe(false);
  });

  it('getTopup niega recargas ajenas', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.creditTopup.findUnique.mockResolvedValue({ id: 't1', merchantId: 'm-otro' });

    await expect(service.getTopup('user-1', 't1')).rejects.toThrow(ForbiddenException);
  });
});
