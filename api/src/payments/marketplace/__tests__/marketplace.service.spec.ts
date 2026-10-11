// api/src/payments/marketplace/__tests__/marketplace.service.spec.ts
import { Test } from '@nestjs/testing';
import { MarketplaceService } from '../marketplace.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnvoPayProvider } from '../../providers/onvopay.provider';

describe('MarketplaceService', () => {
  const prisma = {
    merchantProfile: { findUnique: jest.fn(), update: jest.fn(async (a: any) => a.data) },
  };
  const onvo = {
    createConnectedAccount: jest.fn(),
    getConnectedAccount: jest.fn(),
    regenerateOnboardingLink: jest.fn(),
    listSellerIntents: jest.fn(),
  };
  const svc = async () =>
    (
      await Test.createTestingModule({
        providers: [
          MarketplaceService,
          { provide: PrismaService, useValue: prisma },
          { provide: OnvoPayProvider, useValue: onvo },
        ],
      }).compile()
    ).get(MarketplaceService);

  it('creates the connected account and stores id + status, returning the url', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      businessName: 'KyL Bowls',
    });
    onvo.createConnectedAccount.mockResolvedValueOnce({
      id: 'ca_1',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/x',
    });
    const out = await (await svc()).startOnboarding('m1');
    expect(out).toEqual({
      accountId: 'ca_1',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/x',
    });
    expect(onvo.createConnectedAccount).toHaveBeenCalledWith('KyL Bowls', 5);
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { onvoConnectedAccountId: 'ca_1', onvoOnboardingStatus: 'pending_onboarding' },
    });
  });

  it('returns refresh when the account already exists', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'awaiting_approval' });
    const out = await (await svc()).startOnboarding('m1');
    expect(out).toEqual({ accountId: 'ca_1', status: 'awaiting_approval' });
  });

  it('marks active and enables card payments on refresh', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).refreshStatus('m1');
    expect(out).toEqual({ accountId: 'ca_1', status: 'active' });
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { onvoOnboardingStatus: 'active', cardPaymentsEnabled: true },
    });
  });

  it('404s the link regen into refresh when onboarding already completed', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.regenerateOnboardingLink.mockResolvedValueOnce({ error: 'already_completed' });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).regenerateLink('m1');
    expect((out as any).status).toBe('active');
  });

  it('lists seller intents through the primary key with the seller header', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.listSellerIntents.mockResolvedValueOnce([
      { id: 'pi_1', amount: 10000, status: 'succeeded' },
    ]);
    const out = await (await svc()).sellerIntents('m1');
    expect(out).toEqual([{ id: 'pi_1', amount: 10000, status: 'succeeded' }]);
  });

  it('throws when the merchant has no connected account', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: null,
    });
    await expect((await svc()).sellerIntents('m1')).rejects.toThrow('Sin cuenta conectada');
  });
});
