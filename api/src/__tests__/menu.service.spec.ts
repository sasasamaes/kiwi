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
    const tx: any = {
      menuItemVariantGroup: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      menuItemVariantOption: { createMany: jest.fn() },
      menuItem: { update: jest.fn().mockImplementation(async ({ data }: any) => data) },
    };
    prisma = {
      merchantProfile: { findUnique: jest.fn() },
      menuItem: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      merchantKiosk: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
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

  describe('kioskos', () => {
    it('el menú público trae kioskos activos y el kiosko de cada item', async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        row({ id: 'a', kioskId: 'k1', kiosk: { id: 'k1', name: 'Kiosko Ana' } }),
        row({ id: 'b', kioskId: null, kiosk: null }),
      ]);
      prisma.merchantKiosk.findMany.mockResolvedValue([
        { id: 'k1', name: 'Kiosko Ana', description: 'Historia', imageUrl: null, sortOrder: 0 },
      ]);
      const res = await service.getMenuItems('merchant-1');
      expect(res.kiosks).toEqual([
        { id: 'k1', name: 'Kiosko Ana', description: 'Historia', imageUrl: null, sortOrder: 0 },
      ]);
      expect(res.items.find((i: any) => i.id === 'a').kiosk).toEqual({
        id: 'k1',
        name: 'Kiosko Ana',
      });
    });

    it('crear kiosko valida nombre y topea en 30', async () => {
      await expect(service.createKiosk('u1', { name: '' })).rejects.toThrow('requerido');
      prisma.merchantKiosk.count.mockResolvedValue(30);
      await expect(service.createKiosk('u1', { name: 'Otro' })).rejects.toThrow('Máximo 30');
    });

    it('asignar item a kiosko ajeno se rechaza', async () => {
      prisma.merchantKiosk.findUnique.mockResolvedValue({ id: 'k9', merchantId: 'otro' });
      await expect(
        service.createMenuItem('u1', {
          name: 'X',
          category: 'C',
          price: 100,
          kioskId: 'k9',
        }),
      ).rejects.toThrow('Kiosko inválido');
    });

    it('crear y editar item acepta kiosko propio', async () => {
      prisma.merchantKiosk.findUnique.mockResolvedValue({ id: 'k1', merchantId: 'merchant-1' });
      prisma.menuItem.findFirst.mockResolvedValue(null);
      prisma.menuItem.create.mockImplementation(async ({ data }: any) => ({ id: 'n', ...data }));
      const created: any = await service.createMenuItem('u1', {
        name: 'Cuajada',
        category: 'Mercadito',
        price: 2000,
        kioskId: 'k1',
      });
      expect(created.kioskId).toBe('k1');

      prisma.menuItem.findUnique.mockResolvedValue({ id: 'n', merchantId: 'merchant-1' });
      const updated: any = await service.updateMenuItem('u1', 'n', { kioskId: null });
      expect(updated.kioskId).toBeNull();
    });

    it('borrar kiosko ajeno se rechaza', async () => {
      prisma.merchantKiosk.findUnique.mockResolvedValue({ id: 'k9', merchantId: 'otro' });
      await expect(service.deleteKiosk('u1', 'k9')).rejects.toThrow('No puedes borrar');
      expect(prisma.merchantKiosk.delete).not.toHaveBeenCalled();
    });
  });

  describe('stockAdjust', () => {
    const txStub = (updateImpl: any) => ({
      menuItemVariantGroup: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      menuItemVariantOption: { createMany: jest.fn() },
      menuItem: { update: jest.fn().mockImplementation(updateImpl) },
    });

    beforeEach(() => {
      prisma.menuItem.findUnique.mockResolvedValue({
        id: 'n',
        merchantId: 'merchant-1',
        stockQty: 59,
      });
    });

    it('suma atómico sobre el vigente e ignora el absoluto', async () => {
      const calls: any[] = [];
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn(
          txStub(async ({ data }: any) => {
            calls.push(data);
            return { id: 'n', stockQty: 64 };
          }),
        ),
      );
      await service.updateMenuItem('u1', 'n', { stockQty: 59, stockAdjust: 5 });
      expect(calls[0]).toEqual(expect.objectContaining({ stockQty: { increment: 5 } }));
      expect(calls[0].stockQty).not.toBe(59);
    });

    it('pisa en 0 si queda negativo', async () => {
      const calls: any[] = [];
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn(
          txStub(async ({ data }: any) => {
            calls.push(data);
            return calls.length === 1 ? { id: 'n', stockQty: -3 } : { id: 'n', stockQty: 0 };
          }),
        ),
      );
      await service.updateMenuItem('u1', 'n', { stockAdjust: -100 });
      expect(calls[1]).toEqual(expect.objectContaining({ stockQty: 0 }));
    });

    it('rechaza sin control de stock y valores inválidos', async () => {
      prisma.menuItem.findUnique.mockResolvedValue({
        id: 'n',
        merchantId: 'merchant-1',
        stockQty: null,
      });
      await expect(service.updateMenuItem('u1', 'n', { stockAdjust: 5 })).rejects.toThrow(
        'Sin control de stock',
      );
      await expect(service.updateMenuItem('u1', 'n', { stockAdjust: 0 })).rejects.toThrow(
        'stockAdjust inválido',
      );
      await expect(service.updateMenuItem('u1', 'n', { stockAdjust: 'x' })).rejects.toThrow(
        'stockAdjust inválido',
      );
    });
  });
});
