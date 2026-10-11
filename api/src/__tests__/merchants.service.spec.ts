// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsService } from '../merchants/merchants.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MerchantsService.updateProfile — redes sociales', () => {
  let service: MerchantsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      merchantProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', userId: 'u1' }),
        update: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notifyFollowers: jest.fn() } },
      ],
    }).compile();
    service = module.get<MerchantsService>(MerchantsService);
  });

  it('normaliza @usuario a URL y teléfono a wa.me', async () => {
    const data: any = await service.updateProfile('u1', {
      socials: {
        instagram: '@mi_negocio',
        facebook: 'https://facebook.com/minegocio',
        tiktok: 'minegocio',
        whatsapp: '8888-1234',
        otro: 'https://evil.example',
      },
    });
    expect(data.socials).toEqual({
      instagram: 'https://instagram.com/mi_negocio',
      facebook: 'https://facebook.com/minegocio',
      tiktok: 'https://tiktok.com/@minegocio',
      whatsapp: 'https://wa.me/50688881234',
    });
  });

  it('todo vacío → null (limpia redes)', async () => {
    const data: any = await service.updateProfile('u1', {
      socials: { instagram: '', whatsapp: 'no-es-telefono' },
    });
    expect(data.socials).toBeNull();
  });

  it('sin socials no toca la columna', async () => {
    const data: any = await service.updateProfile('u1', { businessName: 'X' });
    expect('socials' in data).toBe(false);
  });
});
