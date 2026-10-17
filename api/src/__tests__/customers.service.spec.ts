// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Libreta de direcciones: crear con validación, tope, ownership en
 * editar/borrar/default, y sincronización del perfil al marcar default.
 */
describe('CustomersService addresses', () => {
  let service: CustomersService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      customerProfile: { findUnique: jest.fn(), upsert: jest.fn() },
      customerAddress: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('crea el primer lugar como default y valida requeridos', async () => {
    prisma.customerAddress.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'a1', ...data }),
    );
    const res = await service.createAddress('u1', {
      label: 'Casa',
      address: 'Centro, 100 norte',
      latitude: 10.15,
      longitude: -85.455,
      deliveryZone: 'centro',
    });
    expect(res.isDefault).toBe(true);
    await expect(service.createAddress('u1', { label: '', address: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('topea en 10 lugares', async () => {
    prisma.customerAddress.count.mockResolvedValue(10);
    await expect(service.createAddress('u1', { label: 'Otro', address: 'x' })).rejects.toThrow(
      'Máximo 10',
    );
    expect(prisma.customerAddress.create).not.toHaveBeenCalled();
  });

  it('editar/borrar de otro dueño da 404', async () => {
    prisma.customerAddress.findUnique.mockResolvedValue({ id: 'a1', userId: 'otro' });
    await expect(service.updateAddress('u1', 'a1', { label: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deleteAddress('u1', 'a1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setDefaultAddress('u1', 'a1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('default limpia los demás y sincroniza el perfil', async () => {
    prisma.customerAddress.findUnique.mockResolvedValue({
      id: 'a1',
      userId: 'u1',
      address: 'Casa mamá',
      latitude: '10.2',
      longitude: '-85.4',
      deliveryZone: 'centro',
    });
    await service.setDefaultAddress('u1', 'a1');
    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { isDefault: false },
    });
    expect(prisma.customerAddress.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { isDefault: true },
    });
    expect(prisma.customerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ defaultAddress: 'Casa mamá' }),
      }),
    );
  });
});
