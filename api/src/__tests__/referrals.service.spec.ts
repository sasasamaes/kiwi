// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReferralsService } from '../referrals/referrals.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Códigos de referido: crear en mayúsculas, ofertas saneadas por rol,
 * validación pública por app y conteo de usos desde users.
 */
describe('ReferralsService', () => {
  let service: ReferralsService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      referralCode: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReferralsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
  });

  it('crea el código en mayúsculas con ofertas por rol', async () => {
    prisma.referralCode.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'r1', ...data }),
    );
    const res = await service.create({
      code: 'kiko',
      offers: {
        customer: { title: '₡2.000', detail: 'Primer pedido' },
        driver: { title: 'Bono', detail: '' },
        admin: { title: 'hack', detail: 'x' },
      } as any,
    });
    expect(prisma.referralCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'KIKO',
        offers: {
          customer: { title: '₡2.000', detail: 'Primer pedido' },
          driver: { title: 'Bono', detail: '' },
        },
      }),
    });
    expect(res.uses).toBe(0);
  });

  it('rechaza duplicados y códigos malformados', async () => {
    prisma.referralCode.findUnique.mockResolvedValue({ id: 'r1', code: 'KIKO' });
    await expect(service.create({ code: 'KIKO' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create({ code: 'a' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralCode.create).not.toHaveBeenCalled();
  });

  it('validateForRole devuelve la oferta de ESA app', async () => {
    prisma.referralCode.findUnique.mockResolvedValue({
      code: 'KIKO',
      active: true,
      offers: { customer: { title: 'T', detail: 'D' } },
    });
    expect(await service.validateForRole('kiko', 'customer')).toEqual({
      valid: true,
      code: 'KIKO',
      offer: { title: 'T', detail: 'D' },
    });
    // Otro rol sin oferta: válido pero sin oferta.
    expect(await service.validateForRole('kiko', 'driver')).toEqual({
      valid: true,
      code: 'KIKO',
      offer: null,
    });
    prisma.referralCode.findUnique.mockResolvedValue({ code: 'X', active: false, offers: {} });
    expect(await service.validateForRole('x', 'customer')).toEqual({ valid: false });
  });

  it('assertValidForRegister normaliza o lanza 400', async () => {
    prisma.referralCode.findUnique.mockResolvedValue({ code: 'WICHO', active: true });
    await expect(service.assertValidForRegister('wicho', 'driver')).resolves.toBe('WICHO');
    await expect(service.assertValidForRegister('', 'driver')).resolves.toBeUndefined();
    prisma.referralCode.findUnique.mockResolvedValue(null);
    await expect(service.assertValidForRegister('NOPE', 'driver')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('list cuenta usos por código', async () => {
    prisma.referralCode.findMany.mockResolvedValue([{ code: 'KIKO' }, { code: 'WICHO' }]);
    prisma.user.groupBy.mockResolvedValue([
      { referredByCode: 'KIKO', _count: { referredByCode: 3 } },
    ]);
    const res = await service.list();
    expect(res.referrals).toEqual([
      { code: 'KIKO', uses: 3 },
      { code: 'WICHO', uses: 0 },
    ]);
  });
});
