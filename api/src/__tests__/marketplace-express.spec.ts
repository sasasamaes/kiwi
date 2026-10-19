// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
jest.mock(
  '@nestjs/websockets',
  () => ({
    WebSocketGateway: () => () => {},
    WebSocketServer: () => () => {},
    SubscribeMessage: () => () => {},
    ConnectedSocket: () => () => {},
    MessageBody: () => () => {},
  }),
  { virtual: true },
);
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });

import { Test } from '@nestjs/testing';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnvoPayProvider } from '../payments/providers/onvopay.provider';
import { StellarProvider } from '../payments/providers/stellar.provider';
import { CreditsService } from '../credits/credits.service';

describe('Marketplace express charge with driver onBehalfOf', () => {
  const order = {
    id: 'e1',
    orderType: 'express',
    merchantId: 'm1',
    driverId: 'd1',
    totalAmount: 2000,
    status: 'pending',
    customerId: 'cust1',
  };

  let prisma: any;
  let capturedSessionArg: any;
  let onvo: any;

  beforeEach(() => {
    capturedSessionArg = undefined;
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pay1' }),
        update: jest.fn(),
      },
      merchantProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'm1',
          onvoConnectedAccountId: null,
          onvoOnboardingStatus: null,
          cardPaymentsEnabled: true,
        }),
      },
      driverProfile: { findUnique: jest.fn() },
    };
    onvo = {
      createCheckoutSession: jest.fn(async (arg: any) => {
        capturedSessionArg = arg;
        return { success: true, checkoutUrl: 'https://onvo/z', sessionId: 'cs_9' };
      }),
    };
  });

  const buildService = async () =>
    (
      await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: PrismaService, useValue: prisma },
          { provide: OnvoPayProvider, useValue: onvo },
          { provide: StellarProvider, useValue: {} },
          { provide: CreditsService, useValue: {} },
        ],
      }).compile()
    ).get(PaymentsService);

  it('sends the active driver account on express charges (logged flow)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'd1',
      onvoConnectedAccountId: 'ca_9',
      onvoOnboardingStatus: 'active',
    });
    const svc = await buildService();
    await svc.createPayment(
      { orderId: 'e1', method: 'onvopay_card', amount: 2000 } as any,
      'cust1',
      'admin',
    );
    expect(capturedSessionArg.onBehalfOf).toBe('ca_9');
  });

  it('sends the active driver account on express charges (guest flow)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'd1',
      onvoConnectedAccountId: 'ca_9',
      onvoOnboardingStatus: 'active',
    });
    const svc = await buildService();
    await svc.createGuestPayment({ orderId: 'e1', method: 'onvopay_card' } as any);
    expect(capturedSessionArg.onBehalfOf).toBe('ca_9');
  });

  it('falls back without onBehalfOf when the driver account is not active (logged flow)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'd1',
      onvoConnectedAccountId: null,
      onvoOnboardingStatus: null,
    });
    const svc = await buildService();
    await svc.createPayment(
      { orderId: 'e1', method: 'onvopay_card', amount: 2000 } as any,
      'cust1',
      'admin',
    );
    expect(capturedSessionArg.onBehalfOf).toBeUndefined();
  });

  it('falls back without onBehalfOf when the driver account is not active (guest flow)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'd1',
      onvoConnectedAccountId: null,
      onvoOnboardingStatus: null,
    });
    const svc = await buildService();
    await svc.createGuestPayment({ orderId: 'e1', method: 'onvopay_card' } as any);
    expect(capturedSessionArg.onBehalfOf).toBeUndefined();
  });
});
