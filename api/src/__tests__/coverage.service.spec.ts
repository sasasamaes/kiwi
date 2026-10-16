// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CoverageService } from '../service-area/coverage.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/**
 * Lista de espera por cobertura: área operativa, deduplicación, resumen por
 * ciudad y aviso al expandirse.
 */
describe('CoverageService', () => {
  let service: CoverageService;
  let prisma: any;
  let mail: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      coverageInterest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      city: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mail = { sendMarketing: jest.fn().mockResolvedValue({ sent: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverageService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get<CoverageService>(CoverageService);
  });

  it('inServiceArea: Nicoya sí, San José no', () => {
    expect(CoverageService.inServiceArea(10.1467, -85.452)).toBe(true);
    expect(CoverageService.inServiceArea(10.15, -85.455)).toBe(true);
    expect(CoverageService.inServiceArea(9.9281, -84.0907)).toBe(false);
    expect(CoverageService.inServiceArea(undefined, undefined)).toBe(false);
    expect(CoverageService.inServiceArea('x', 'y')).toBe(false);
  });

  it('normalizeCity agrupa variantes del mismo lugar', () => {
    expect(CoverageService.normalizeCity('san-jose')).toBe('San Jose');
    expect(CoverageService.normalizeCity('  LIBERIA ')).toBe('Liberia');
    expect(CoverageService.normalizeCity('')).toBe('');
  });

  it('recordInterest crea y no duplica por email+ciudad', async () => {
    await service.recordInterest({
      email: 'A@x.com',
      city: 'san-jose',
      source: 'register-customer',
    });
    expect(prisma.coverageInterest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'a@x.com', city: 'San Jose' }),
    });

    prisma.coverageInterest.findFirst.mockResolvedValue({ id: 'existe' });
    prisma.coverageInterest.create.mockClear();
    await service.recordInterest({
      email: 'a@x.com',
      city: 'San Jose',
      source: 'register-customer',
    });
    expect(prisma.coverageInterest.create).not.toHaveBeenCalled();
  });

  it('recordInterest jamás revienta (best-effort)', async () => {
    prisma.coverageInterest.findFirst.mockRejectedValue(new Error('db caída'));
    await expect(
      service.recordInterest({ email: 'a@x.com', city: 'X', source: 'order-blocked' }),
    ).resolves.toBeUndefined();
  });

  it('summary agrupa por ciudad con pendientes primero', async () => {
    prisma.coverageInterest.findMany.mockResolvedValue([
      { city: 'San Jose', notified: false, email: 'a@x.com', createdAt: new Date() },
      { city: 'San Jose', notified: true, email: 'b@x.com', createdAt: new Date() },
      { city: 'Liberia', notified: false, email: 'c@x.com', createdAt: new Date() },
    ]);
    const res = await service.summary();
    expect(res.demand[0]).toEqual(
      expect.objectContaining({ city: 'San Jose', total: 2, notified: 1, pending: 1 }),
    );
    expect(res.demand[1]).toEqual(expect.objectContaining({ city: 'Liberia', pending: 1 }));
  });

  it('notifyCity avisa a pendientes con email y los marca', async () => {
    prisma.coverageInterest.findMany.mockResolvedValue([
      { id: '1', email: 'a@x.com', city: 'Liberia' },
      { id: '2', email: null, city: 'Liberia' },
    ]);
    const res = await service.notifyCity('liberia', 'admin-1');
    expect(res).toEqual({ sent: 1, failed: 1 });
    expect(mail.sendMarketing).toHaveBeenCalledTimes(1);
    expect(mail.sendMarketing).toHaveBeenCalledWith(
      'a@x.com',
      expect.stringContaining('Liberia'),
      expect.any(String),
    );
    expect(prisma.coverageInterest.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { notified: true },
    });
  });
});
