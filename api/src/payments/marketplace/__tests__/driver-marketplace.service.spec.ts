import { Test } from '@nestjs/testing';
import { DriverMarketplaceService } from '../driver-marketplace.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnvoPayProvider } from '../../providers/onvopay.provider';

describe('DriverMarketplaceService', () => {
  const prisma = {
    driverProfile: { findUnique: jest.fn(), update: jest.fn(async (a: any) => a.data) },
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
          DriverMarketplaceService,
          { provide: PrismaService, useValue: prisma },
          { provide: OnvoPayProvider, useValue: onvo },
        ],
      }).compile()
    ).get(DriverMarketplaceService);

  it('creates the account with fee 15 and stores id + status', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({ id: 'd1', fullName: 'Villa' });
    onvo.createConnectedAccount.mockResolvedValueOnce({
      id: 'ca_9',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/y',
    });
    const out = await (await svc()).startOnboarding('d1');
    expect(out).toEqual({
      accountId: 'ca_9',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/y',
    });
    expect(onvo.createConnectedAccount).toHaveBeenCalledWith('Villa', 15);
  });

  it('marks active on refresh (no card flag for drivers)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: 'd1',
      onvoConnectedAccountId: 'ca_9',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).refreshStatus('d1');
    expect(out).toEqual({ accountId: 'ca_9', status: 'active' });
    expect(prisma.driverProfile.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { onvoOnboardingStatus: 'active' },
    });
  });

  it('lists seller intents through the primary key with the seller header', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: 'd1',
      onvoConnectedAccountId: 'ca_9',
    });
    onvo.listSellerIntents.mockResolvedValueOnce([
      { id: 'pi_1', amount: 10000, status: 'succeeded' },
    ]);
    const out = await (await svc()).sellerIntents('d1');
    expect(out).toEqual([{ id: 'pi_1', amount: 10000, status: 'succeeded' }]);
  });

  it('throws when the driver has no connected account', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: 'd1',
      onvoConnectedAccountId: null,
    });
    await expect((await svc()).sellerIntents('d1')).rejects.toThrow('Sin cuenta conectada');
  });
});
