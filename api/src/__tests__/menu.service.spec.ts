// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { crWeekday } from '../common/costa-rica-time';

describe('MenuService', () => {
  let service: MenuService;
  let prisma: any;

  const row = (over: any = {}) => ({
    id: 'item-x',
    merchantId: 'merchant-1',
    name: 'Rollos de canela',
    description: null,
    price: 2500,
    image: null,
    category: 'Postres',
    isPopular: false,
    isAvailable: true,
    sortOrder: 0,
    availableDays: [],
    stockQty: null,
    dailyQty: null,
    stockDay: null,
    fulfillNote: null,
    variantGroups: [],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      merchantProfile: { findUnique: jest.fn() },
      menuItem: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notifyFollowers: jest.fn() } },
      ],
    }).compile();
    service = module.get<MenuService>(MenuService);
    prisma.merchantProfile.findUnique.mockResolvedValue({ id: 'merchant-1' });
  });

  describe('getMenuItems — vitrina de mañana', () => {
    const tomorrow = (crWeekday(new Date()) + 1) % 7;
    const otherDay = (tomorrow + 2) % 7;

    it('incluye lo de mañana marcado offeredTomorrow (aunque hoy no se ofrezca)', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        row({ id: 'hoy', name: 'Casado', availableDays: [] }),
        row({ id: 'manana', name: 'Rollos', availableDays: [tomorrow] }),
        row({ id: 'otro-dia', name: 'Tamal', availableDays: [otherDay] }),
      ]);

      const res = await service.getMenuItems('merchant-1');
      const byId = new Map(res.items.map((i: any) => [i.id, i]));

      expect(byId.has('hoy')).toBe(true);
      expect((byId.get('hoy') as any).offeredTomorrow).toBe(false);
      expect(byId.has('manana')).toBe(true);
      expect((byId.get('manana') as any).offeredTomorrow).toBe(true);
      // Otro día (ni hoy ni mañana): no se muestra.
      expect(byId.has('otro-dia')).toBe(false);
    });

    it('oculta agotados aunque sean de mañana', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        row({ id: 'agotado', availableDays: [tomorrow], stockQty: 0 }),
      ]);
      const res = await service.getMenuItems('merchant-1');
      expect(res.items).toHaveLength(0);
    });
  });

  describe('tomorrowPreview', () => {
    it('agrupa por comercio solo lo de mañana con stock', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        {
          id: 'i1',
          name: 'Rollos',
          price: 2500,
          image: null,
          stockQty: 50,
          fulfillNote: 'Se entrega el jueves a las 2:00 p. m.',
          merchant: { id: 'm1', businessName: 'Casa', logoUrl: null, isHomeCook: true },
        },
      ]);
      const res = await service.tomorrowPreview('nicoya');
      expect(res.items).toHaveLength(1);
      expect(res.items[0].businessName).toBe('Casa');
      expect(res.items[0].items[0].fulfillNote).toContain('jueves');
      expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ availableDays: { has: expect.any(Number) } }),
        }),
      );
    });
  });
});
