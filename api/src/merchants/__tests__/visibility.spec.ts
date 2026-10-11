// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test } from '@nestjs/testing';
import { MerchantsController } from '../merchants.controller';
import { MerchantsService } from '../merchants.service';
import { AdsService } from '../../ads/ads.service';
import { MarketplaceService } from '../../payments/marketplace/marketplace.service';
import { ImageUploadService } from '../../menu/image-upload.service';

describe('PUT /merchants/me/visibility', () => {
  const merchantsService = { findByUserId: jest.fn(), setListed: jest.fn() };
  const controller = async () =>
    (
      await Test.createTestingModule({
        controllers: [MerchantsController],
        providers: [
          { provide: MerchantsService, useValue: merchantsService },
          { provide: AdsService, useValue: {} },
          { provide: MarketplaceService, useValue: {} },
          { provide: ImageUploadService, useValue: {} },
        ],
      }).compile()
    ).get(MerchantsController);

  it('flips only the caller merchant own flag', async () => {
    merchantsService.findByUserId.mockResolvedValueOnce({ id: 'm1', userId: 'u1' });
    merchantsService.setListed.mockResolvedValueOnce({ id: 'm1', isListed: false });
    const out = await (await controller()).setOwnVisibility({ sub: 'u1' }, { listed: false });
    expect(merchantsService.findByUserId).toHaveBeenCalledWith('u1');
    expect(merchantsService.setListed).toHaveBeenCalledWith('m1', false);
    expect(out).toEqual({ id: 'm1', isListed: false });
  });
});
