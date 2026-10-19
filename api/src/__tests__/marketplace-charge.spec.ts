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

describe('Marketplace charge with onBehalfOf', () => {
  const order = {
    id: 'o1',
    merchantId: 'm1',
    totalAmount: 10000,
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
      merchantProfile: { findUnique: jest.fn() },
    };
    onvo = {
      createCheckoutSession: jest.fn(async (arg: any) => {
        capturedSessionArg = arg;
        return { success: true, checkoutUrl: 'https://onvo/x', sessionId: 'cs_1' };
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

  it('sends onBehalfOf of the active connected account (logged flow)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
      onvoOnboardingStatus: 'active',
      cardPaymentsEnabled: true,
    });
    const svc = await buildService();
    await svc.createPayment(
      { orderId: 'o1', method: 'onvopay_card', amount: 10000 } as any,
      'cust1',
      'admin',
    );
    expect(capturedSessionArg.onBehalfOf).toBe('ca_1');
  });

  it('sends onBehalfOf of the active connected account (guest flow)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
      onvoOnboardingStatus: 'active',
      cardPaymentsEnabled: true,
    });
    const svc = await buildService();
    await svc.createGuestPayment({ orderId: 'o1', method: 'onvopay_card' } as any);
    expect(capturedSessionArg.onBehalfOf).toBe('ca_1');
  });

  it('falls back without onBehalfOf when the merchant has no active account (logged flow)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'm1',
      onvoConnectedAccountId: null,
      onvoOnboardingStatus: null,
      cardPaymentsEnabled: true,
    });
    const svc = await buildService();
    await svc.createPayment(
      { orderId: 'o1', method: 'onvopay_card', amount: 10000 } as any,
      'cust1',
      'admin',
    );
    expect(capturedSessionArg.onBehalfOf).toBeUndefined();
  });

  it('falls back without onBehalfOf when the merchant has no active account (guest flow)', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValue({
      id: 'm1',
      onvoConnectedAccountId: null,
      onvoOnboardingStatus: null,
      cardPaymentsEnabled: true,
    });
    const svc = await buildService();
    await svc.createGuestPayment({ orderId: 'o1', method: 'onvopay_card' } as any);
    expect(capturedSessionArg.onBehalfOf).toBeUndefined();
  });
});
